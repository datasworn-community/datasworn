import {
	DATASWORN_SCHEMA_VERSION,
	IdParser,
	type Datasworn,
	type DataswornSource
} from '@datasworn-community/core'

import { Validators } from './semantic-validators.js'
import type { DataswornValidators, SchemaValidator } from './validators.js'

type JsonObject = Record<string, unknown>

export interface NamedRulesPackageSource<
	TSource extends DataswornSource.RulesPackage = DataswornSource.RulesPackage
> {
	name: string
	data: TSource
}

export interface RulesPackageMetadata {
	id: string
	type?: Datasworn.RulesPackage['type']
}

export interface AssembledRulesPackage<
	TTarget extends Datasworn.RulesPackage = Datasworn.RulesPackage
> {
	data: TTarget
	index: Map<string, unknown>
}

export type Logger = Record<
	'warn' | 'info' | 'debug' | 'error',
	(message?: unknown, ...optionalParams: unknown[]) => unknown
>

function isObject(value: unknown): value is JsonObject {
	return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function cloneJsonValue<TValue>(value: TValue): TValue {
	return JSON.parse(JSON.stringify(value)) as TValue
}

function mergeInto(target: JsonObject, source: JsonObject): void {
	for (const [key, value] of Object.entries(source)) {
		if (isObject(value)) {
			const current = target[key]
			if (!isObject(current)) target[key] = {}
			mergeInto(target[key] as JsonObject, value)
		} else target[key] = cloneJsonValue(value)
	}
}

function validateMetadata(
	name: string,
	source: DataswornSource.RulesPackage,
	expected: RulesPackageMetadata
): void {
	if (source._id != null && source._id !== expected.id)
		throw new Error(
			`${name}: package _id ${source._id} does not match configured id ${expected.id}`
		)
	if (expected.type != null && source.type != null && source.type !== expected.type)
		throw new Error(
			`${name}: package type ${source.type} does not match configured type ${expected.type}`
		)
}

function validateSource<TSource extends DataswornSource.RulesPackage>(
	name: string,
	data: TSource,
	validator: SchemaValidator<TSource>
): void {
	try {
		if (validator(data)) return
		throw new Error("doesn't match the DataswornSource schema")
	} catch (error) {
		throw new Error(`${name}: source validation failed: ${String(error)}`, {
			cause: error
		})
	}
}

function validateSemantics(index: Map<string, unknown>): void {
	for (const [id, node] of index) {
		if (!isObject(node) || typeof node.type !== 'string') continue
		const validator = Validators[node.type as keyof typeof Validators] as
			| ((value: never) => true)
			| undefined
		if (validator == null) continue
		try {
			validator(node as never)
		} catch (error) {
			throw new Error(`<${id}> ${String(error)}`)
		}
	}
}

/** Assemble already-parsed source fragments without doing filesystem work. */
export function assembleRulesPackage<
	TTarget extends Datasworn.RulesPackage = Datasworn.RulesPackage,
	TSource extends DataswornSource.RulesPackage = DataswornSource.RulesPackage
>(
	namedSources: readonly NamedRulesPackageSource<TSource>[],
	validators: DataswornValidators<TTarget, TSource>,
	expected: RulesPackageMetadata
): AssembledRulesPackage<TTarget> {
	const sources = namedSources
		.map(({ name, data }) => ({ name, data: cloneJsonValue(data) }))
		.sort((left, right) => left.name.localeCompare(right.name, 'en-US'))
	const inferredType = expected.type ?? sources.find(({ data }) => data.type != null)?.data.type
	const metadata = { ...expected, type: inferredType }
	const merged: JsonObject = {
		_id: expected.id,
		...(inferredType == null ? {} : { type: inferredType }),
		datasworn_version: DATASWORN_SCHEMA_VERSION
	}

	for (const { name, data } of sources) {
		validateSource(name, data, validators.source)
		validateMetadata(name, data, metadata)
		mergeInto(merged, data as unknown as JsonObject)
	}

	const index = new Map<string, unknown>()
	IdParser.assignIdsInRulesPackage(
		merged as unknown as DataswornSource.RulesPackage,
		index
	)
	const data = merged as unknown as TTarget
	if (!validators.output(data))
		throw new Error('Datasworn schema validation failed')
	validateSemantics(index)

	return { data, index }
}

/** Iron Vault-compatible stateful adapter around the in-memory assembler. */
export class RulesPackageBuilder<
	TSource extends DataswornSource.RulesPackage = DataswornSource.RulesPackage,
	TTarget extends Datasworn.RulesPackage = Datasworn.RulesPackage
> {
	static #schemaValidator?: SchemaValidator<Datasworn.RulesPackage>
	static #sourceSchemaValidator?: SchemaValidator<DataswornSource.RulesPackage>

	static init({
		validator,
		sourceValidator
	}: {
		validator: SchemaValidator<Datasworn.RulesPackage>
		sourceValidator: SchemaValidator<DataswornSource.RulesPackage>
	}): typeof RulesPackageBuilder {
		RulesPackageBuilder.#schemaValidator = validator
		RulesPackageBuilder.#sourceSchemaValidator = sourceValidator
		return RulesPackageBuilder
	}

	static get schemaValidator(): SchemaValidator<Datasworn.RulesPackage> {
		if (RulesPackageBuilder.#schemaValidator == null)
			throw new Error('RulesPackageBuilder has not been initialized')
		return RulesPackageBuilder.#schemaValidator
	}

	static get sourceSchemaValidator(): SchemaValidator<DataswornSource.RulesPackage> {
		if (RulesPackageBuilder.#sourceSchemaValidator == null)
			throw new Error('RulesPackageBuilder has not been initialized')
		return RulesPackageBuilder.#sourceSchemaValidator
	}

	static get isInitialized(): boolean {
		return (
			RulesPackageBuilder.#schemaValidator != null &&
			RulesPackageBuilder.#sourceSchemaValidator != null
		)
	}

	readonly files = new Map<string, NamedRulesPackageSource<TSource>>()
	readonly errors = new Map<string, unknown>()
	readonly index = new Map<string, unknown>()
	readonly logger: Logger
	readonly id: string
	#result = {} as TTarget

	constructor(id: string, logger: Logger) {
		if (!RulesPackageBuilder.isInitialized)
			throw new Error(
				'RulesPackageBuilder constructor is missing validator functions. Set them with RulesPackageBuilder.init before creating an instance.'
			)
		this.id = id
		this.logger = logger
	}

	get packageType(): Datasworn.RulesPackage['type'] | undefined {
		for (const { data } of this.files.values()) if (data.type != null) return data.type
		return undefined
	}

	addFiles(...files: NamedRulesPackageSource<TSource>[]): this {
		for (const file of files) {
			this.files.set(file.name, file)
			this.errors.delete(file.name)
			try {
				validateSource(
					file.name,
					file.data,
					RulesPackageBuilder.sourceSchemaValidator as SchemaValidator<TSource>
				)
				validateMetadata(file.name, file.data, {
					id: this.id,
					type: this.packageType
				})
			} catch (error) {
				this.errors.set(file.name, error)
			}
		}
		return this
	}

	build(): this {
		if (this.errors.size > 0) {
			const details = [...this.errors]
				.map(([name, error]) => `"${name}" failed validation: ${String(error)}`)
				.join('\n')
			throw new Error(`Couldn't build "${this.id}". ${details}`)
		}

		const result = assembleRulesPackage<TTarget, TSource>(
			[...this.files.values()],
			{
				output: RulesPackageBuilder.schemaValidator as SchemaValidator<TTarget>,
				source: RulesPackageBuilder.sourceSchemaValidator as SchemaValidator<TSource>
			},
			{ id: this.id, type: this.packageType }
		)
		this.#result = result.data
		this.index.clear()
		for (const [id, node] of result.index) this.index.set(id, node)
		return this
	}

	toJSON(): TTarget {
		return this.#result
	}
}
