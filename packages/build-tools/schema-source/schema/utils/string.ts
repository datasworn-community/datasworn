import { camelCase } from 'lodash-es'
import type { PascalCase as PascalCaseNoDot } from 'type-fest'
import type { Utils } from '@datasworn-community/core'

export function capitalize<Str extends string = string>(str: Str) {
	return (str[0].toLocaleUpperCase('en-US') + str.slice(1)) as Capitalize<Str>
}

export type PascalCase<T extends string> = PascalCaseNoDot<
	Utils.Join<Utils.Split<T, '.'>, '_'>
>

export function pascalCase<Str extends string = string>(str: Str) {
	return capitalize(camelCase(str.split('.').join('_'))) as PascalCase<Str>
}
