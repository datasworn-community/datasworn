import {
	Kind,
	type ObjectOptions,
	type Static,
	type TObject,
	Type
} from '@sinclair/typebox'
import type { TAnyId } from '../common/Id.js'
import { Documentation } from '../common/Text.js'
import { Computed } from '../Utils.js'
import { FlatIntersect } from '../utils/FlatIntersect.js'
import { setDescriptions } from '../utils/typebox.js'

const IdNodeBase = Type.Object({
	_id: Computed(Type.String()),
	_comment: Type.Optional(Type.Ref(Documentation))
})

export function IdNode<TBase extends TObject>(
	base: TBase,
	_id: TAnyId,
	options: ObjectOptions = {}
) {
	const enhancedBase = FlatIntersect(
		[IdNodeBase, Type.Object({ _id: Computed(_id) }), base],
		{
			[Kind]: 'Object',
			...options
		}
	)

	return setDescriptions(enhancedBase, {
		_id: 'The unique Datasworn ID for this node.'
	})
}
export type TIdNode<TBase extends TObject> = ReturnType<
	typeof IdNode<TBase>
> & { static: IdNode<Static<TBase>> }

export type IdNode<TBase extends object> = TBase & Static<typeof IdNodeBase>
