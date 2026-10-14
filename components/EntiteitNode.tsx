'use client';

import { Handle, Position, type NodeProps, type Node } from '@xyflow/react';
import { SOORT_LABEL, type Soort } from '@/lib/types';

export type EntiteitNodeData = {
  naam: string;
  soort: Soort;
  korte_omschrijving: string | null;
};

export type EntiteitNodeType = Node<EntiteitNodeData, 'entiteit'>;

/**
 * Een blok op de kaart. Alle soorten zijn donkergroen met witte tekst; de soort
 * is te zien aan de vorm en de rand:
 *   persoon          ronde pil met een lichte rand
 *   holding          rechthoek met een dubbele rand
 *   werkmaatschappij effen rechthoek
 */
const VORM: Record<Soort, string> = {
  // Pil met een lichte buitenrand.
  persoon: 'rounded-full border border-groen-100/70',
  // Dubbele rand: buitenrand, een strook achtergrondgroen, dan een lichte lijn.
  holding: 'rounded-md border border-groen-800 dubbele-rand',
  // Effen rechthoek.
  werkmaatschappij: 'rounded-md border border-groen-800',
};

export default function EntiteitNode({ data, selected }: NodeProps<EntiteitNodeType>) {
  return (
    <div
      className={[
        'bg-groen-700 w-[180px] cursor-pointer px-4 py-3 text-center text-white transition-all',
        'hover:bg-groen-600 hover:-translate-y-0.5 hover:shadow-lg',
        VORM[data.soort],
        selected ? 'ring-groen-900 ring-2 ring-offset-2' : '',
      ].join(' ')}
      title={data.korte_omschrijving ?? data.naam}
    >
      <Handle type="target" position={Position.Top} isConnectable={false} />

      <div className="truncate text-[14px] leading-tight font-medium">{data.naam}</div>
      <div className="mt-0.5 truncate text-[10px] tracking-wide text-white/65 uppercase">
        {SOORT_LABEL[data.soort]}
      </div>

      <Handle type="source" position={Position.Bottom} isConnectable={false} />
    </div>
  );
}
