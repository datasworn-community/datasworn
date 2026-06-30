import { type Static, Type } from '@sinclair/typebox'
import * as Text from '../common/Text.js'

export const EntityPrompt = Type.Object(
	{ text: Type.Ref(Text.MarkdownString) },
	{
		$id: 'EntityPrompt',
		description:
			'This type is a placeholder and may see signficant changes in v0.2.0.',
		releaseStage: 'experimental'
	}
)
export type EntityPrompt = Static<typeof EntityPrompt>
