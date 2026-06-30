import { Type } from '@sinclair/typebox'
import * as Text from '../common/Text.js'

export const Cyclopedia = Type.Object({
	name: Type.Ref(Text.Label),
	features: Type.Array(Type.Ref(Text.MarkdownString)),
	summary: Type.Optional(Type.Ref(Text.MarkdownString)),
	description: Type.Ref(Text.MarkdownString),
	quest_starter: Type.Optional(Type.Ref(Text.MarkdownString)),
	your_truth: Type.Optional(Type.Ref(Text.MarkdownString))
})
