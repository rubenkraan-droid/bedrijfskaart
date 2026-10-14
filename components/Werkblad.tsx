"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef, useState } from "react";
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
  type Edge,
  type Node,
  type NodeChange,
} from "@xyflow/react";
import { supabaseBrowser } from "@/lib/supabase/client";
import type { Entiteit, Relatie, Soort } from "@/lib/types";
import EntiteitNode, { type EntiteitNodeType } from "./EntiteitNode";
import Kop from "./Kop";
import Zoekbalk, { type Treffer } from "./Zoekbalk";

const nodeTypes = { entiteit: EntiteitNode };

const LIJN = "#9aa09b";

const defaultEdgeOptions = {
  type: "smoothstep" as const,
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
  const router = useRouter();

  const [nodes, setNodes, onNodesChange] = useNodesState<EntiteitNodeType>(
    entiteiten.map((e) => ({
      id: e.id,
      type: "entiteit" as const,
      position: { x: Number(e.positie_x), y: Number(e.positie_y) },
      data: {
        naam: e.naam,
        soort: e.soort,
        korte_omschrijving: e.korte_omschrijving,
      },
      draggable: isBeheerder,
    })),
  );

  const zichtbaar = useMemo(
    () => new Set(entiteiten.map((e) => e.id)),
    [entiteiten],
  );

  const [edges, , onEdgesChange] = useEdgesState<Edge>(
    relaties
      .filter(
        (r) => zichtbaar.has(r.van_entiteit) && zichtbaar.has(r.naar_entiteit),
      )
      .map((r) => ({
        id: r.id,
        source: r.van_entiteit,
        target: r.naar_entiteit,
      })),
  );

  const [melding, setMelding] = useState<string | null>(null);

  // Laatst opgeslagen posities, om op terug te vallen als opslaan mislukt.
  const laatstOpgeslagen = useRef(
    new Map(
      entiteiten.map((e) => [
        e.id,
        { x: Number(e.positie_x), y: Number(e.positie_y) },
      ]),
    ),
  );

  /** Een onderdeel binnenlopen: een eigen pagina met zijn eigen adres. */
  const openOnderdeel = useCallback(
    (id: string, vak: "overzicht" | "processen" = "overzicht") => {
      const vraag = vak === "overzicht" ? "" : `&vak=${vak}`;
      router.push(`/onderdeel/?id=${id}${vraag}`);
    },
    [router],
  );

  const kiesTreffer = useCallback(
    (treffer: Treffer) => openOnderdeel(treffer.entiteitId, treffer.vak),
    [openOnderdeel],
  );

  // Verslepen opslaan. Alleen beheerders mogen dit; lukt het toch niet, dan
  // springt het blok terug naar de laatst opgeslagen plek.
  const opSleepEinde = useCallback(
    async (_: unknown, node: Node) => {
      if (!isBeheerder) return;
      const nieuw = {
        x: Math.round(node.position.x),
        y: Math.round(node.position.y),
      };

      const { error } = await supabaseBrowser()
        .from("kaart_entiteiten")
        .update({ positie_x: nieuw.x, positie_y: nieuw.y })
        .eq("id", node.id);

      if (error) {
        const terug = laatstOpgeslagen.current.get(node.id);
        if (terug) {
          setNodes((huidig) =>
            huidig.map((n) =>
              n.id === node.id ? { ...n, position: terug } : n,
            ),
          );
        }
        setMelding(`Positie niet opgeslagen: ${error.message}`);
        return;
      }

      laatstOpgeslagen.current.set(node.id, nieuw);
      setMelding("Nieuwe positie opgeslagen.");
      setTimeout(() => setMelding(null), 2500);
    },
    [isBeheerder, setNodes],
  );

  // Verslepen mag de pagina niet openen, dus wordt er gekeken of het blok
  // werkelijk verplaatst is.
  const sleepBegin = useRef<{ x: number; y: number } | null>(null);

  const opNodesChange = useCallback(
    (wijzigingen: NodeChange<EntiteitNodeType>[]) => onNodesChange(wijzigingen),
    [onNodesChange],
  );

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Kop naam={naam} email={email} isBeheerder={isBeheerder}>
        <Zoekbalk entiteiten={entiteiten} opKiezen={kiesTreffer} />
      </Kop>

      <div className="relative min-h-0 flex-1">
        {entiteiten.length === 0 ? (
          <GeenToegang />
        ) : (
          // React Flow rekent met procenten en krijgt zijn hoogte niet altijd
          // door van een flexbox. Met absolute plaatsing is de bak altijd echt.
          <div className="absolute inset-0">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={opNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeDragStart={(_, node) => {
                sleepBegin.current = { ...node.position };
              }}
              onNodeDragStop={opSleepEinde}
              onNodeClick={(_, node) => {
                const begin = sleepBegin.current;
                const verplaatst =
                  begin &&
                  (Math.abs(begin.x - node.position.x) > 2 ||
                    Math.abs(begin.y - node.position.y) > 2);
                sleepBegin.current = null;
                if (!verplaatst) openOnderdeel(node.id);
              }}
              nodeTypes={nodeTypes}
              defaultEdgeOptions={defaultEdgeOptions}
              nodesDraggable={isBeheerder}
              nodesConnectable={false}
              edgesFocusable={false}
              fitView
              fitViewOptions={{ padding: 0.2, maxZoom: 1 }}
              minZoom={0.2}
              maxZoom={2}
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
          </div>
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
    </div>
  );
}

function GeenToegang() {
  return (
    <div className="flex h-full items-center justify-center px-6 py-16">
      <div className="max-w-sm text-center">
        <h2 className="text-lg font-semibold tracking-tight">
          Nog geen onderdelen
        </h2>
        <p className="text-inkt-zacht mt-2 text-sm leading-relaxed">
          Je hebt nog geen toegang tot onderdelen van de bedrijfskaart. Vraag
          een beheerder om je toegang te geven.
        </p>
      </div>
    </div>
  );
}

const LEGENDA: Array<{ soort: Soort; label: string; klasse: string }> = [
  { soort: "persoon", label: "Persoon", klasse: "rounded-full" },
  {
    soort: "holding",
    label: "Holding",
    klasse: "rounded-[3px] dubbele-rand-klein",
  },
  {
    soort: "werkmaatschappij",
    label: "Werkmaatschappij",
    klasse: "rounded-[3px]",
  },
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
