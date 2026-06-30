import { type Static, Type } from '@sinclair/typebox'
import { Meter } from '../common/Inputs.js'
import { MarkdownString } from '../common/Text.js'
import { Assign } from '../utils/FlatIntersect.js'
import { Tags } from './TagRule.js'

export const ConditionMeterRule = Assign(
	Type.Object({
		description: Type.Ref(MarkdownString, {
			description: 'A description of this condition meter.'
		}),
		shared: Type.Boolean({
			default: false,
			description: 'Is this condition meter shared by all players?'
		}),
		tags: Type.Optional(Type.Ref(Tags, { releaseStage: 'experimental' }))
	}),
	Meter(Type.Literal(true)),
	{
		$id: 'ConditionMeterRule',
		description: 'Describes a standard player character condition meter.'
	}
)

export type ConditionMeterRule = Static<typeof ConditionMeterRule>
