"use client";

import { useRouter } from "next/navigation";
import { useCallback, useMemo, useRef } from "react";
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
      draggable: true,
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

  // De vaste plek van elk blok, zoals die in de database staat.
  const vastePositie = useRef(
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

  // Slepen mag, maar het blijft niet staan: zodra je loslaat veert het blok
  // terug naar zijn vaste plek. Zo kun je de kaart even uit elkaar trekken om
  // iets beter te zien, zonder dat de indeling voor iedereen verandert. Een
  // positie echt wijzigen doe je in het beheerscherm, bij Positie x en y.
  const opSleepEinde = useCallback(
    (_: unknown, node: Node) => {
      const vast = vastePositie.current.get(node.id);
      if (!vast) return;

      setNodes((huidig) =>
        huidig.map((n) =>
          n.id === node.id
            ? { ...n, position: vast, className: "terugveren" }
            : n,
        ),
      );

      // De klasse weer weghalen, anders zou ook het volgende slepen zelf
      // vloeiend meebewegen in plaats van de muis te volgen.
      window.setTimeout(() => {
        setNodes((huidig) =>
          huidig.map((n) =>
            n.id === node.id ? { ...n, className: undefined } : n,
          ),
        );
      }, 300);
    },
    [setNodes],
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
    soort: "eenmanszaak",
    label: "Eenmanszaak",
    klasse: "rounded-l-full rounded-r-[3px]",
  },
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
