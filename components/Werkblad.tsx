'use client';

import { useCallback, useMemo, useRef, useState } from 'react';
import {
  Background,
  BackgroundVariant,
  Controls,
  MarkerType,
  MiniMap,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  useReactFlow,
  type Edge,
  type Node,
  type NodeChange,
} from '@xyflow/react';
import { supabaseBrowser } from '@/lib/supabase/client';
import type { Entiteit, Relatie, Soort } from '@/lib/types';
import EntiteitNode, { type EntiteitNodeType } from './EntiteitNode';
import Kop from './Kop';
import Zijpaneel, { type Tabblad } from './Zijpaneel';
import Zoekbalk, { type Treffer } from './Zoekbalk';

const BLOK_BREEDTE = 180;
const BLOK_HOOGTE = 56;

const nodeTypes = { entiteit: EntiteitNode };

const LIJN = '#9aa09b';

const defaultEdgeOptions = {
  type: 'smoothstep' as const,
  markerEnd: {
    type: MarkerType.ArrowClosed,
    width: 16,
    height: 16,
    color: LIJN,
  },
};

type Props = {
  entiteiten: Entiteit[];
  relaties: Relatie[];
  isBeheerder: boolean;
  naam: string | null;
  email: string;
};

export default function Werkblad(props: Props) {
  return (
    <ReactFlowProvider>
      <Binnenkant {...props} />
    </ReactFlowProvider>
  );
}

function Binnenkant({ entiteiten, relaties, isBeheerder, naam, email }: Props) {
  const { setCenter } = useReactFlow();

  const [nodes, setNodes, onNodesChange] = useNodesState<EntiteitNodeType>(
    entiteiten.map((e) => ({
      id: e.id,
      type: 'entiteit' as const,
      position: { x: Number(e.positie_x), y: Number(e.positie_y) },
      data: {
        naam: e.naam,
        soort: e.soort,
        korte_omschrijving: e.korte_omschrijving,
      },
      draggable: isBeheerder,
    }))
  );

  const zichtbaar = useMemo(() => new Set(entiteiten.map((e) => e.id)), [entiteiten]);

  const [edges, , onEdgesChange] = useEdgesState<Edge>(
    relaties
      .filter((r) => zichtbaar.has(r.van_entiteit) && zichtbaar.has(r.naar_entiteit))
      .map((r) => ({
        id: r.id,
        source: r.van_entiteit,
        target: r.naar_entiteit,
      }))
  );

  const [geselecteerdId, setGeselecteerdId] = useState<string | null>(null);
  const [tabblad, setTabblad] = useState<Tabblad>('overzicht');
  const [melding, setMelding] = useState<string | null>(null);

  // Laatst opgeslagen posities, om op terug te vallen als opslaan mislukt.
  const laatstOpgeslagen = useRef(
    new Map(entiteiten.map((e) => [e.id, { x: Number(e.positie_x), y: Number(e.positie_y) }]))
  );

  const perId = useMemo(() => new Map(entiteiten.map((e) => [e.id, e])), [entiteiten]);
  const geselecteerd = geselecteerdId ? (perId.get(geselecteerdId) ?? null) : null;

  const eigenaren = useMemo(() => {
    if (!geselecteerdId) return [];
    return relaties
      .filter((r) => r.naar_entiteit === geselecteerdId)
      .map((r) => perId.get(r.van_entiteit)?.naam)
      .filter((n): n is string => Boolean(n))
      .sort((a, b) => a.localeCompare(b, 'nl'));
  }, [geselecteerdId, relaties, perId]);

  const bezittingen = useMemo(() => {
    if (!geselecteerdId) return [];
    return relaties
      .filter((r) => r.van_entiteit === geselecteerdId)
      .map((r) => perId.get(r.naar_entiteit)?.naam)
      .filter((n): n is string => Boolean(n))
      .sort((a, b) => a.localeCompare(b, 'nl'));
  }, [geselecteerdId, relaties, perId]);

  const centreer = useCallback(
    (id: string) => {
      const node = nodes.find((n) => n.id === id);
      if (!node) return;
      setCenter(node.position.x + BLOK_BREEDTE / 2, node.position.y + BLOK_HOOGTE / 2, {
        zoom: 1,
        duration: 500,
      });
    },
    [nodes, setCenter]
  );

  const kiesTreffer = useCallback(
    (treffer: Treffer) => {
      setGeselecteerdId(treffer.entiteitId);
      setTabblad(treffer.tabblad);
      centreer(treffer.entiteitId);
      setNodes((huidig) =>
        huidig.map((n) => ({ ...n, selected: n.id === treffer.entiteitId }))
      );
    },
    [centreer, setNodes]
  );

  // Verslepen opslaan. Alleen beheerders mogen dit; lukt het toch niet, dan
  // springt het blok terug naar de laatst opgeslagen plek.
  const opSleepEinde = useCallback(
    async (_: unknown, node: Node) => {
      if (!isBeheerder) return;
      const nieuw = { x: Math.round(node.position.x), y: Math.round(node.position.y) };

      const { error } = await supabaseBrowser()
        .from('kaart_entiteiten')
        .update({ positie_x: nieuw.x, positie_y: nieuw.y })
        .eq('id', node.id);

      if (error) {
        const terug = laatstOpgeslagen.current.get(node.id);
        if (terug) {
          setNodes((huidig) =>
            huidig.map((n) => (n.id === node.id ? { ...n, position: terug } : n))
          );
        }
        setMelding(`Positie niet opgeslagen: ${error.message}`);
        return;
      }

      laatstOpgeslagen.current.set(node.id, nieuw);
      setMelding('Nieuwe positie opgeslagen.');
      setTimeout(() => setMelding(null), 2500);
    },
    [isBeheerder, setNodes]
  );

  const opNodesChange = useCallback(
    (wijzigingen: NodeChange<EntiteitNodeType>[]) => {
      onNodesChange(wijzigingen);
      for (const w of wijzigingen) {
        if (w.type === 'select' && w.selected) {
          setGeselecteerdId(w.id);
          setTabblad('overzicht');
        }
      }
    },
    [onNodesChange]
  );

  function sluitPaneel() {
    setGeselecteerdId(null);
    setNodes((huidig) => huidig.map((n) => ({ ...n, selected: false })));
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Kop naam={naam} email={email} isBeheerder={isBeheerder}>
        <Zoekbalk entiteiten={entiteiten} opKiezen={kiesTreffer} />
      </Kop>

      <div className="relative flex min-h-0 flex-1">
        <div className="relative min-w-0 flex-1">
          {entiteiten.length === 0 ? (
            <GeenToegang />
          ) : (
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={opNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeDragStop={opSleepEinde}
              onPaneClick={sluitPaneel}
              nodeTypes={nodeTypes}
              defaultEdgeOptions={defaultEdgeOptions}
              nodesDraggable={isBeheerder}
              nodesConnectable={false}
              edgesFocusable={false}
              fitView
              fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
              minZoom={0.2}
              maxZoom={2}
              proOptions={{ hideAttribution: false }}
            >
              <Background
                variant={BackgroundVariant.Dots}
                gap={22}
                size={1.3}
                color="#c8cdc7"
              />
              <Controls showInteractive={false} position="bottom-left" />
              <MiniMap
                position="bottom-right"
                pannable
                zoomable
                className="hidden sm:block"
                nodeColor="#2d4a3e"
                maskColor="rgba(245,246,244,0.72)"
              />
              <Legenda />
            </ReactFlow>
          )}

          {melding && (
            <div
              role="status"
              className="border-rand bg-paneel text-inkt absolute bottom-4 left-1/2 z-20 -translate-x-1/2 rounded-md border px-3 py-2 text-sm shadow-md"
            >
              {melding}
            </div>
          )}
        </div>

        {geselecteerd && (
          <Zijpaneel
            entiteit={geselecteerd}
            eigenaren={eigenaren}
            bezittingen={bezittingen}
            tabblad={tabblad}
            opTabblad={setTabblad}
            opSluiten={sluitPaneel}
          />
        )}
      </div>
    </div>
  );
}

function GeenToegang() {
  return (
    <div className="flex h-full items-center justify-center px-6 py-16">
      <div className="max-w-sm text-center">
        <h2 className="text-lg font-semibold tracking-tight">Nog geen onderdelen</h2>
        <p className="text-inkt-zacht mt-2 text-sm leading-relaxed">
          Je hebt nog geen toegang tot onderdelen van de bedrijfskaart. Vraag een
          beheerder om je toegang te geven.
        </p>
      </div>
    </div>
  );
}

const LEGENDA: Array<{ soort: Soort; label: string; klasse: string }> = [
  { soort: 'persoon', label: 'Persoon', klasse: 'rounded-full' },
  { soort: 'holding', label: 'Holding', klasse: 'rounded-[3px] dubbele-rand-klein' },
  { soort: 'werkmaatschappij', label: 'Werkmaatschappij', klasse: 'rounded-[3px]' },
];

function Legenda() {
  return (
    <div className="border-rand bg-paneel/95 absolute top-3 right-3 z-10 rounded-md border px-3 py-2.5 backdrop-blur">
      <div className="text-inkt-zacht mb-1.5 text-[10px] font-semibold tracking-wide uppercase">
        Soorten
      </div>
      <ul className="space-y-1.5">
        {LEGENDA.map(({ soort, label, klasse }) => (
          <li key={soort} className="flex items-center gap-2">
            <span className={`bg-groen-700 h-3.5 w-7 shrink-0 ${klasse}`} />
            <span className="text-xs">{label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
