'use client';

import { useMemo, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  type Edge,
  type Node,
  type NodeProps,
} from '@xyflow/react';
import { UITVOERING_LABEL, type ProcesMetStappen, type Uitvoering } from '@/lib/types';

/**
 * Een niveau dieper de kaart in.
 *
 * Op de hoofdkaart zijn de bedrijven blokken. Vlieg je er een binnen, dan zijn
 * de processen daar weer blokken, in dezelfde vormtaal. Klik je op een proces,
 * dan vallen de stappen uiteen als een keten, van links naar rechts, waarbij je
 * aan de vorm ziet wat automatisch gaat en wat iemand met de hand doet.
 */

const LIJN = '#9aa09b';

const defaultEdgeOptions = {
  type: 'smoothstep' as const,
  markerEnd: { type: MarkerType.ArrowClosed, width: 16, height: 16, color: LIJN },
};

// --- De blokken ------------------------------------------------------------

type ProcesData = { titel: string; stappen: number; automatisch: number };
type ProcesNodeType = Node<ProcesData, 'proces'>;

function ProcesNode({ data, selected }: NodeProps<ProcesNodeType>) {
  return (
    <div
      className={[
        'bg-groen-700 border-groen-800 w-[200px] cursor-pointer rounded-md border px-4 py-3 text-center text-white transition-all',
        'hover:bg-groen-600 hover:-translate-y-0.5 hover:shadow-lg',
        selected ? 'ring-groen-900 ring-2 ring-offset-2' : '',
      ].join(' ')}
    >
      <div className="text-[14px] leading-tight font-medium">{data.titel}</div>
      <div className="mt-0.5 text-[10px] tracking-wide text-white/65 uppercase">
        {data.stappen === 0
          ? 'nog geen stappen'
          : `${data.stappen} ${data.stappen === 1 ? 'stap' : 'stappen'} · ${data.automatisch} automatisch`}
      </div>
    </div>
  );
}

type StapData = {
  nummer: number;
  titel: string;
  uitvoering: Uitvoering;
  toelichting: string | null;
};
type StapNodeType = Node<StapData, 'stap'>;

function StapNode({ data }: NodeProps<StapNodeType>) {
  const automatisch = data.uitvoering === 'automatisch';
  return (
    <div
      className={[
        'w-[190px] px-3.5 py-2.5 text-white',
        // Automatisch krijgt de dubbele rand die ook een holding kenmerkt: iets
        // dat uit zichzelf draait. Handmatig is een effen blok.
        automatisch
          ? 'bg-groen-600 border-groen-800 dubbele-rand rounded-md border'
          : 'bg-groen-700 border-groen-800 rounded-md border',
      ].join(' ')}
    >
      <Handle type="target" position={Position.Left} isConnectable={false} />
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-white/20 text-[10px] font-semibold">
          {data.nummer}
        </span>
        <div className="min-w-0">
          <div className="text-[13px] leading-tight font-medium">{data.titel}</div>
          <div className="mt-0.5 text-[9px] tracking-wide text-white/65 uppercase">
            {UITVOERING_LABEL[data.uitvoering]}
          </div>
          {data.toelichting && (
            <div className="mt-0.5 text-[11px] leading-snug text-white/75">
              {data.toelichting}
            </div>
          )}
        </div>
      </div>
      <Handle type="source" position={Position.Right} isConnectable={false} />
    </div>
  );
}

const nodeTypes = { proces: ProcesNode, stap: StapNode };

// --- De kaart --------------------------------------------------------------

export default function ProcesKaart(props: {
  processen: ProcesMetStappen[];
  naam: string;
}) {
  return (
    <ReactFlowProvider>
      <Binnenkant {...props} />
    </ReactFlowProvider>
  );
}

function Binnenkant({
  processen,
  naam,
}: {
  processen: ProcesMetStappen[];
  naam: string;
}) {
  const [open, setOpen] = useState<string | null>(null);
  const gekozen = processen.find((p) => p.id === open) ?? null;

  const { nodes, edges } = useMemo(() => {
    if (gekozen) {
      // De stappen als keten, van links naar rechts, drie per rij.
      const perRij = 3;
      const stapNodes: Node[] = gekozen.stappen.map((stap, i) => ({
        id: stap.id,
        type: 'stap',
        position: {
          x: (i % perRij) * 260,
          y: Math.floor(i / perRij) * 170,
        },
        data: {
          nummer: i + 1,
          titel: stap.titel,
          uitvoering: stap.uitvoering,
          toelichting: stap.toelichting,
        },
        draggable: false,
      }));

      const stapEdges: Edge[] = gekozen.stappen.slice(1).map((stap, i) => ({
        id: `${gekozen.stappen[i].id}-${stap.id}`,
        source: gekozen.stappen[i].id,
        target: stap.id,
      }));

      return { nodes: stapNodes, edges: stapEdges };
    }

    // Alle processen naast elkaar, drie per rij.
    const perRij = 3;
    const procesNodes: Node[] = processen.map((proces, i) => ({
      id: proces.id,
      type: 'proces',
      position: {
        x: (i % perRij) * 250,
        y: Math.floor(i / perRij) * 140,
      },
      data: {
        titel: proces.titel,
        stappen: proces.stappen.length,
        automatisch: proces.stappen.filter((s) => s.uitvoering === 'automatisch')
          .length,
      },
      draggable: false,
    }));

    return { nodes: procesNodes, edges: [] as Edge[] };
  }, [processen, gekozen]);

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        {gekozen ? (
          <>
            <div className="min-w-0">
              <button
                type="button"
                onClick={() => setOpen(null)}
                className="text-inkt-zacht hover:text-groen-800 flex min-h-11 items-center gap-1.5 text-sm transition-colors"
              >
                <span aria-hidden>&larr;</span> Alle hoofdtaken van {naam}
              </button>
              <h2 className="text-lg font-semibold tracking-tight">{gekozen.titel}</h2>
              {gekozen.beschrijving && (
                <p className="text-inkt-zacht mt-0.5 text-sm">{gekozen.beschrijving}</p>
              )}
            </div>
          </>
        ) : (
          <p className="text-inkt-zacht text-sm">
            Klik op een hoofdtaak om de stappen te zien.
          </p>
        )}
      </div>

      <div className="border-rand bg-grond relative h-[min(60vh,480px)] overflow-hidden rounded-lg border">
        {gekozen && gekozen.stappen.length === 0 && (
          <div className="absolute inset-0 z-10 flex items-center justify-center px-6">
            <p className="text-inkt-zacht max-w-sm text-center text-sm leading-relaxed">
              Deze hoofdtaak heeft nog geen stappen. Een beheerder legt ze vast via
              Bewerken, en geeft per stap aan of die automatisch verloopt of dat
              iemand hem met de hand doet.
            </p>
          </div>
        )}
        <div className="absolute inset-0">
          <ReactFlow
            nodes={nodes}
            edges={edges}
            nodeTypes={nodeTypes}
            defaultEdgeOptions={defaultEdgeOptions}
            onNodeClick={(_, node) => {
              if (!gekozen) setOpen(node.id);
            }}
            nodesDraggable={false}
            nodesConnectable={false}
            edgesFocusable={false}
            fitView
            fitViewOptions={{ padding: 0.25, maxZoom: 1 }}
            minZoom={0.3}
            maxZoom={1.6}
          >
            <Background variant={BackgroundVariant.Dots} gap={22} size={1.3} color="#c8cdc7" />
            <Controls showInteractive={false} position="bottom-left" />
          </ReactFlow>
        </div>
      </div>
    </div>
  );
}
