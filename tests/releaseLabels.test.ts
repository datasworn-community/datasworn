import { describe, expect, test } from 'bun:test'

import { combineReleaseLabels } from '../scripts/releaseLabels.js'

describe('combineReleaseLabels', () => {
	test('keeps the labels of a single pull request as they are', () => {
		expect(combineReleaseLabels([{ number: 1, labels: ['release:minor-schema'] }])).toEqual([
			'release:minor-schema'
		])
		expect(combineReleaseLabels([{ number: 1, labels: [] }])).toEqual([])
		// The plan's own ambiguity check reports this, as it did before.
		expect(
			combineReleaseLabels([{ number: 1, labels: ['release:patch', 'release:none'] }])
		).toEqual(['release:patch', 'release:none'])
	})

	test('has nothing to combine without pull requests', () => {
		expect(combineReleaseLabels([])).toEqual([])
	})

	test('lets the strongest label of several pull requests win', () => {
		expect(
			combineReleaseLabels([
				{ number: 1, labels: ['release:patch'] },
				{ number: 2, labels: ['release:minor-schema'] },
				{ number: 3, labels: ['release:none'] }
			])
		).toEqual(['release:minor-schema'])
		expect(
			combineReleaseLabels([
				{ number: 1, labels: ['release:minor-schema'] },
				{ number: 2, labels: ['release:major-schema'] }
			])
		).toEqual(['release:major-schema'])
	})

	test('counts a pull request without a release label as a patch', () => {
		expect(
			combineReleaseLabels([
				{ number: 1, labels: ['release:none'] },
				{ number: 2, labels: [] }
			])
		).toEqual(['release:patch'])
	})

	test('releases nothing only when every pull request asked for that', () => {
		expect(
			combineReleaseLabels([
				{ number: 1, labels: ['release:none'] },
				{ number: 2, labels: ['release:none'] }
			])
		).toEqual(['release:none'])
	})

	test('names the pull request whose release intent is ambiguous', () => {
		expect(() =>
			combineReleaseLabels([
				{ number: 1, labels: ['release:patch'] },
				{ number: 2, labels: ['release:patch', 'release:minor-schema'] }
			])
		).toThrow('Release intent of #2 is ambiguous')
	})
})
