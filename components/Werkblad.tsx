"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
} from "@xyflow/react";
import type { Entiteit, Relatie } from "@/lib/types";
import EntiteitNode, { type EntiteitNodeType } from "./EntiteitNode";
import Kop from "./Kop";
import { useSoortFilter } from "./SoortFilter";
import SoortMenu from "./SoortMenu";
import Zoekbalk, { type Treffer } from "./Zoekbalk";

const nodeTypes = { entiteit: EntiteitNode };

/** Afmetingen van een blok, om er precies op te kunnen inzoomen. */
const BLOK_BREEDTE = 180;
const BLOK_HOOGTE = 56;

/** Hoe lang het aanvliegen duurt, in milliseconden. */
const AANVLIEGDUUR = 340;

const LIJN = "#9aa09b";
const LIJN_OP = "#2d4a3e";

/**
 * Gebogen lijnen in plaats van haakse. Twee lijnen naar hetzelfde blok liepen
 * eerst door dezelfde verticale gang naar beneden en leken daardoor een lijn.
 * Met een boog houdt elke lijn zijn eigen weg en zie je ze elkaar kruisen.
 */
const defaultEdgeOptions = {
  type: "bezier" as const,
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
  const { fitView, setCenter } = useReactFlow();
  const { verborgen, wissel, toonAlles } = useSoortFilter();

  /** Welk blok je op dit moment aanwijst, om zijn lijnen te laten oplichten. */
  const [zweef, setZweef] = useState<string | null>(null);

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

  /**
   * Een onderdeel binnenvliegen: de kaart zoomt eerst naar het blok toe, en pas
   * als je er bovenop zit opent de pagina van dat onderdeel. Daardoor voelt het
   * alsof je dat blok in gaat in plaats van ergens anders heen te springen.
   */
  const openOnderdeel = useCallback(
    (id: string, vak: "overzicht" | "processen" = "overzicht") => {
      const vraag = vak === "overzicht" ? "" : `&vak=${vak}`;
      const doel = `/onderdeel/?id=${id}${vraag}`;

      const node = nodes.find((n) => n.id === id);
      if (!node || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        router.push(doel);
        return;
      }

      setCenter(
        node.position.x + BLOK_BREEDTE / 2,
        node.position.y + BLOK_HOOGTE / 2,
        { zoom: 2, duration: AANVLIEGDUUR },
      );
      window.setTimeout(() => router.push(doel), AANVLIEGDUUR - 60);
    },
    [router, nodes, setCenter],
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

  // Uitgezette soorten verdwijnen van de kaart, en een lijn blijft alleen staan
  // als beide uiteinden zichtbaar zijn. Dat is dezelfde regel die de database
  // hanteert voor onderdelen waar iemand geen toegang toe heeft.
  const soortVanNode = useMemo(
    () => new Map(entiteiten.map((e) => [e.id, e.soort])),
    [entiteiten],
  );

  const isVerborgen = useCallback(
    (id: string) => {
      const soort = soortVanNode.get(id);
      return soort !== undefined && verborgen.has(soort);
    },
    [soortVanNode, verborgen],
  );

  // Wie direct aan het aangewezen blok vastzit, blijft op volle sterkte staan.
  const burenVan = useMemo(() => {
    const kaart = new Map<string, Set<string>>();
    for (const r of relaties) {
      if (!kaart.has(r.van_entiteit)) kaart.set(r.van_entiteit, new Set());
      if (!kaart.has(r.naar_entiteit)) kaart.set(r.naar_entiteit, new Set());
      kaart.get(r.van_entiteit)!.add(r.naar_entiteit);
      kaart.get(r.naar_entiteit)!.add(r.van_entiteit);
    }
    return kaart;
  }, [relaties]);

  const zichtbareNodes = useMemo(
    () =>
      nodes.map((n) => {
        const betrokken =
          zweef === null || n.id === zweef || (burenVan.get(zweef)?.has(n.id) ?? false);
        return {
          ...n,
          hidden: isVerborgen(n.id),
          style: { opacity: betrokken ? 1 : 0.35, transition: "opacity 140ms" },
        };
      }),
    [nodes, isVerborgen, zweef, burenVan],
  );

  // Wijs je een blok aan, dan lichten precies zijn eigen lijnen op en vervagen
  // de rest. Zo zie je in een oogopslag wat waar vandaan komt.
  const zichtbareEdges = useMemo(
    () =>
      edges.map((e) => {
        const raakt = zweef !== null && (e.source === zweef || e.target === zweef);
        const gedimd = zweef !== null && !raakt;
        return {
          ...e,
          hidden: isVerborgen(e.source) || isVerborgen(e.target),
          zIndex: raakt ? 10 : 0,
          style: {
            stroke: raakt ? LIJN_OP : LIJN,
            strokeWidth: raakt ? 2.5 : 1.5,
            opacity: gedimd ? 0.18 : 1,
            transition: "stroke 140ms, opacity 140ms",
          },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: raakt ? 18 : 16,
            height: raakt ? 18 : 16,
            color: raakt ? LIJN_OP : LIJN,
          },
        };
      }),
    [edges, isVerborgen, zweef],
  );

  const aantalZichtbaar = zichtbareNodes.filter((n) => !n.hidden).length;

  // De overgebleven blokken netjes in beeld brengen: zowel na het aan- of
  // uitzetten van een soort, als bij het openen, wanneer de bewaarde voorkeur
  // pas bekend wordt nadat de kaart al is opgebouwd.
  useEffect(() => {
    const timer = window.setTimeout(
      () => fitView({ padding: 0.2, maxZoom: 1, duration: 300 }),
      60,
    );
    return () => window.clearTimeout(timer);
  }, [verborgen, fitView]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <Kop naam={naam} email={email} isBeheerder={isBeheerder}>
        <div className="flex w-full items-center gap-2">
          <Zoekbalk entiteiten={entiteiten} opKiezen={kiesTreffer} />
          <SoortMenu
            verborgen={verborgen}
            opWisselen={wissel}
            opAllesTonen={toonAlles}
            aantalZichtbaar={aantalZichtbaar}
            aantalTotaal={entiteiten.length}
          />
        </div>
      </Kop>

      <div className="relative min-h-0 flex-1">
        {entiteiten.length === 0 ? (
          <GeenToegang />
        ) : (
          // React Flow rekent met procenten en krijgt zijn hoogte niet altijd
          // door van een flexbox. Met absolute plaatsing is de bak altijd echt.
          <div className="absolute inset-0">
            <ReactFlow
              nodes={zichtbareNodes}
              edges={zichtbareEdges}
              onNodesChange={opNodesChange}
              onEdgesChange={onEdgesChange}
              onNodeMouseEnter={(_, node) => setZweef(node.id)}
            onNodeMouseLeave={() => setZweef(null)}
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

