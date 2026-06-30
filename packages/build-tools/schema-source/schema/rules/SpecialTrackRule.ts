import { type Static, Type } from '@sinclair/typebox'
import { Label, MarkdownString } from '../common/Text.js'
import { Tags } from './TagRule.js'

export const SpecialTrackRule = Type.Object(
	{
		label: Type.Ref(Label, {
			description: 'A label for this special track.'
		}),
		description: Type.Ref(MarkdownString, {
			description: 'A description of this special track.'
		}),
		shared: Type.Boolean({
			default: false,
			description: 'Is this track shared by all players?'
		}),
		optional: Type.Boolean({
			default: false,
			description: 'Is this track an optional rule?'
		}),
		tags: Type.Optional(Type.Ref(Tags, { releaseStage: 'experimental' }))
	},
	{
		$id: 'SpecialTrackRule',
		description:
			'Describes a special track like Bonds (classic Ironsworn), Failure (Delve), or Legacies (Starforged).'
	}
)
export type SpecialTrackRule = Static<typeof SpecialTrackRule>
