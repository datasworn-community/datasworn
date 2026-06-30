import { type Static, Type } from '@sinclair/typebox'

import { Label, MarkdownString } from '../common/Text.js'
import { Tags } from './TagRule.js'

export const StatRule = Type.Object(
	{
		label: Type.Ref(Label, {
			description: 'A label for this stat.',
			examples: ['edge']
		}),
		description: Type.Ref(MarkdownString, {
			description: 'A description of this stat.',
			examples: ['Quickness, agility, and prowess when fighting at a distance.']
		}),
		tags: Type.Optional(Type.Ref(Tags, { releaseStage: 'experimental' }))
	},
	{
		$id: 'StatRule',
		description: 'Describes a standard player character stat.'
	}
)
export type StatRule = Static<typeof StatRule>
