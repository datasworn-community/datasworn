import type { Datasworn } from '@datasworn-community/core'

const diceExpressionPattern =
	/^(?<count>[1-9][0-9]*)d(?<sides>[1-9][0-9]*)(?<modifier>[+-][1-9][0-9]*)?$/

/** Ensure a dice range is ordered from its minimum to its maximum. */
export function validateDiceRange(range: Datasworn.DiceRange): true {
	if (range.max < range.min)
		throw new Error(
			`DiceRange min (${range.min}) is greater than max (${range.max})`
		)
	return true
}

/** Validate the optional roll range on one oracle row. */
export function validateOracleRollableRow(
	row: Datasworn.OracleRollableRow
): true {
	if (row.roll != null) validateDiceRange(row.roll)
	return true
}

function diceRange(expression: Datasworn.DiceExpression): Datasworn.DiceRange {
	const groups = diceExpressionPattern.exec(expression)?.groups
	if (groups == null)
		throw new Error(`Could not parse ${expression} as a dice expression.`)

	const count = Number(groups.count)
	const sides = Number(groups.sides)
	const modifier = groups.modifier == null ? 0 : Number(groups.modifier)
	return {
		min: count + modifier,
		max: count * sides + modifier
	}
}

/** Validate dice bounds and adjacency of the numbered rows in an oracle. */
export function validateOracleRollable(
	oracle: Datasworn.OracleRollable
): true {
	const possible = diceRange(oracle.dice)
	const numberedRows = oracle.rows
		.map((row, index) => ({ row, index }))
		.filter(
			(entry): entry is typeof entry & { row: { roll: Datasworn.DiceRange } } =>
				entry.row.roll != null
		)

	for (let position = 0; position < numberedRows.length; position++) {
		const { row, index } = numberedRows[position]
		validateOracleRollableRow(row)
		if (row.roll.min < possible.min)
			throw new Error(
				`@ index ${index}: roll.min (${row.roll.min}) is less than the minimum possible roll of ${oracle.dice} (${possible.min})`
			)
		if (row.roll.max > possible.max)
			throw new Error(
				`@ index ${index}: roll.max (${row.roll.max}) is greater than the maximum possible roll of ${oracle.dice} (${possible.max})`
			)

		const previous = numberedRows[position - 1]?.row
		if (previous != null && row.roll.min !== previous.roll.max + 1)
			throw new Error(
				`@ index ${index}: Roll range (${row.roll.min}-${row.roll.max}) is not sequential with previous numbered row (${previous.roll.min}-${previous.roll.max}).`
			)
	}

	return true
}

type OracleRow = Datasworn.OracleRollableRow

function compareParallelRows(
	contents: Record<string, Datasworn.OracleRollable>,
	equal: (left: OracleRow, right: OracleRow) => boolean,
	description: string
): void {
	const entries = Object.entries(contents)
	if (entries.length < 2) return

	const [primaryKey, primary] = entries[0]
	for (const [secondaryKey, secondary] of entries.slice(1)) {
		if (secondary.rows.length !== primary.rows.length)
			throw new Error(
				`${description}: <${secondaryKey}> has ${secondary.rows.length} rows; expected ${primary.rows.length} to match <${primaryKey}>`
			)
		for (let index = 0; index < primary.rows.length; index++) {
			if (!equal(primary.rows[index], secondary.rows[index]))
				throw new Error(
					`${description}: row ${index} of <${secondaryKey}> does not match <${primaryKey}>`
				)
		}
	}
}

function rowsHaveSameRoll(left: OracleRow, right: OracleRow): boolean {
	return left.roll?.min === right.roll?.min && left.roll?.max === right.roll?.max
}

const textProperties = ['text', 'text2', 'text3'] as const

function rowsHaveSameText(left: OracleRow, right: OracleRow): boolean {
	const leftRecord = left as unknown as Record<string, unknown>
	const rightRecord = right as unknown as Record<string, unknown>
	return textProperties.every((key) => leftRecord[key] === rightRecord[key])
}

/** Validate the parallel columns represented by a shared oracle collection. */
export function validateOracleCollection(
	collection: Datasworn.OracleCollection
): true {
	const contents = collection.contents ?? {}
	switch (collection.oracle_type) {
		case 'table_shared_rolls':
			compareParallelRows(
				contents,
				rowsHaveSameRoll,
				'table_shared_rolls child OracleRollables must have the same roll ranges in their rows, in the same order'
			)
			break
		case 'table_shared_text':
		case 'table_shared_text2':
		case 'table_shared_text3':
			compareParallelRows(
				contents,
				rowsHaveSameText,
				`${collection.oracle_type} child OracleRollables must have the same text content in their rows, in the same order`
			)
			break
	}
	return true
}

/** Semantic validators applied after a package passes output-schema validation. */
export const Validators = {
	oracle_rollable: validateOracleRollable,
	oracle_collection: validateOracleCollection
} as const
