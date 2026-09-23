"use client";

import { useEffect, useRef, useState } from "react";
import { Compass, X } from "lucide-react";
import type { Ping } from "@/lib/types";
import { PingCard } from "./cards";
import { PingIcon } from "./visuals";

export function PingMap({ pings, weeklyIds, example, onLike }: {
  pings: Ping[];
  weeklyIds: string[];
  example: boolean;
  onLike: (ping: Ping) => Promise<void>;
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  const [pinnedId, setPinnedId] = useState<string | null>(null);
  const mapRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const outside = (event: PointerEvent) => {
      if (!mapRef.current?.contains(event.target as Node)) {
        setOpenId(null);
        setPinnedId(null);
      }
    };
    document.addEventListener("pointerdown", outside);
    return () => document.removeEventListener("pointerdown", outside);
  }, []);

  return (
    <div className="compliment-map" ref={mapRef}>
      <div className="rift-landscape" aria-hidden="true"><RiftLandscape /></div>
      <div className="map-heading"><span>우리의 칭찬 협곡</span><small>작은 핑 하나, 좋은 행동의 흔적</small></div>
      <span className="map-compass" aria-hidden="true"><Compass size={28} /><small>N</small></span>
      <div className="map-points">
        {pings.slice(0, 6).map((ping, index) => {
          const open = openId === ping.id;
          const rank = weeklyIds.indexOf(ping.id) + 1;
          const popupId = `map-compliment-${ping.id}`;
          const close = (element: HTMLElement) => {
            element.closest(".map-point")?.querySelector<HTMLButtonElement>(".map-pin")?.focus();
            setOpenId(null);
            setPinnedId(null);
          };
          return (
            <div key={ping.id} className={`map-point point-${index} ${open ? "is-open" : ""} ${rank ? "is-ranked" : ""}`}
              onPointerEnter={(event) => { if (event.pointerType === "mouse") setOpenId(ping.id); }}
              onPointerLeave={(event) => {
                if (event.pointerType === "mouse" && pinnedId !== ping.id && !event.currentTarget.contains(document.activeElement)) setOpenId(null);
              }}
              onBlur={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget)) { setOpenId(null); setPinnedId(null); }
              }}
              onKeyDown={(event) => { if (event.key === "Escape") { event.preventDefault(); close(event.currentTarget); } }}
            >
              <button type="button" className="map-pin" aria-label={`${ping.receiver.chatNickname}님에게 도착한 ${example ? "예시 " : ""}칭찬 보기${rank ? `, 이번 주 ${rank}위` : ""}`}
                aria-expanded={open} aria-controls={open ? popupId : undefined}
                onFocus={() => setOpenId(ping.id)}
                onClick={() => {
                  const next = pinnedId === ping.id ? null : ping.id;
                  setPinnedId(next); setOpenId(next);
                }}
              >
                <span className="map-pin-symbol"><span className="map-pin-ripple" /><PingIcon size={45} />{rank > 0 && <span className="map-rank-badge">{rank}</span>}</span>
                <span className="map-pin-name"><b>{ping.receiver.chatNickname}</b>님에게</span>
              </button>
              {open && (
                <section id={popupId} className="map-popup" aria-label={`${ping.receiver.chatNickname}님에게 도착한 칭찬`}>
                  <button className="map-popup-close" aria-label="칭찬 내용 닫기" onClick={(event) => close(event.currentTarget)}><X size={16} /></button>
                  <PingCard ping={ping} index={index} example={example} rank={rank || undefined} onLike={onLike} />
                </section>
              )}
            </div>
          );
        })}
      </div>
      <div className="map-instructions"><span className="map-help-desktop">핑에 마우스를 올려 칭찬을 만나보세요</span><span className="map-help-touch">핑을 눌러 칭찬을 열어보세요</span><small>공감으로 따뜻한 마음을 더해주세요</small></div>
    </div>
  );
}

// Original vector landscape: three stone paths, a river and two forest camps.
// Scales with the viewport without external game assets or image downloads.
function RiftLandscape() {
  const groves = [[180, 136], [280, 118], [368, 142], [180, 244], [276, 226], [320, 352], [470, 396], [613, 353], [731, 339], [677, 433], [803, 250], [608, 175]];
  return (
    <svg viewBox="0 0 1000 580" preserveAspectRatio="xMidYMid slice" className="rift-art" focusable="false">
      <defs>
        <linearGradient id="rift-ground" x2="1" y2="1"><stop stopColor="#193e3d"/><stop offset=".48" stopColor="#122d31"/><stop offset="1" stopColor="#202b40"/></linearGradient>
        <linearGradient id="rift-water" x1="0" y1="1" x2="1" y2="0"><stop stopColor="#184b60"/><stop offset=".5" stopColor="#357d86"/><stop offset="1" stopColor="#1b4f65"/></linearGradient>
        <radialGradient id="rift-glade"><stop stopColor="#2d5b4f"/><stop offset="1" stopColor="#183930"/></radialGradient>
        <radialGradient id="rift-mist"><stop stopColor="#071722" stopOpacity="0"/><stop offset="1" stopColor="#07121e" stopOpacity=".8"/></radialGradient>
        <pattern id="rift-contours" width="80" height="70" patternUnits="userSpaceOnUse"><path d="M-10 35Q20 4 50 25T95 28M-10 48Q20 17 50 38T95 41" fill="none" stroke="#92ac91" strokeOpacity=".045"/></pattern>
        <g id="rift-pine"><ellipse cy="10" rx="14" ry="5" fill="#081d25" opacity=".6"/><path d="M-12 6 0-26 12 6Z" fill="#244e43" stroke="#39725b" strokeWidth=".7"/><path d="M0-26 12 6H0Z" fill="#193c36"/><path d="M-9-2 0-24 9-2" fill="none" stroke="#548b69" strokeOpacity=".35"/></g>
        <g id="rift-tower"><ellipse rx="18" ry="10" fill="#122933" stroke="#668279" strokeWidth="2"/><path d="M-8-2V-18L0-23 8-18V-2L0 3Z" fill="#2d555b" stroke="#79a19b"/><path d="M-5-20 0-31 5-20 0-13Z" fill="#70cbd0" opacity=".8"/></g>
      </defs>
      <rect width="1000" height="580" fill="url(#rift-ground)"/>
      <path d="M-40 78 240 8 339 103 282 180 92 291-20 231ZM84 325 260 284 425 380 403 517 192 545 54 479ZM602 81 824 34 963 135 944 263 769 286 633 218ZM588 377 739 287 984 349 1030 571 796 594 648 505Z" fill="url(#rift-glade)" stroke="#3d6154" strokeWidth="3"/>
      <path d="M16 558C225 421 276 457 408 326S623 271 690 163 879 79 990-2" fill="none" stroke="#0a222d" strokeWidth="93"/>
      <path d="M16 558C225 421 276 457 408 326S623 271 690 163 879 79 990-2" fill="none" stroke="#467573" strokeOpacity=".5" strokeWidth="76"/>
      <path d="M16 558C225 421 276 457 408 326S623 271 690 163 879 79 990-2" fill="none" stroke="url(#rift-water)" strokeWidth="62"/>
      <path d="M16 552C225 415 276 451 408 320S623 265 690 157 879 73 990-8" fill="none" stroke="#83c2b1" strokeOpacity=".16" strokeWidth="2" strokeDasharray="24 15 3 18"/>
      <g fill="none" strokeLinecap="round" strokeLinejoin="round">
        <path d="M116 459 115 146Q115 73 218 72H860M122 474H776Q881 474 881 391V107M121 467 869 99" stroke="#0c242a" strokeWidth="40"/>
        <path d="M116 459 115 146Q115 73 218 72H860M122 474H776Q881 474 881 391V107M121 467 869 99" stroke="#647568" strokeOpacity=".42" strokeWidth="24"/>
        <path d="M116 459 115 146Q115 73 218 72H860M122 474H776Q881 474 881 391V107M121 467 869 99" stroke="#adb392" strokeOpacity=".2" strokeWidth="15" strokeDasharray="6 10"/>
      </g>
      <g fill="#0f282f" stroke="#436d64" strokeWidth="3"><path d="m347 222 24-48 47-9 31 33-19 25-48 6Z"/><path d="m609 331 48-28 39 14 7 47-29 20-51-16Z"/></g>
      <g fill="none" stroke="#599590" opacity=".35"><ellipse cx="398" cy="204" rx="29" ry="14"/><ellipse cx="655" cy="343" rx="29" ry="14"/></g>
      <rect width="1000" height="580" fill="url(#rift-contours)"/>
      {groves.map(([x, y], i) => (
        <g key={i} transform={`translate(${x} ${y})`} opacity=".9">
          {[-1, 0, 1].map((n) => <use key={n} href="#rift-pine" transform={`translate(${n * 21} ${Math.abs(n) * 12}) scale(${1 + (i % 3) * .13})`} />)}
        </g>
      ))}
      <g opacity=".7"><use href="#rift-tower" x="116" y="267"/><use href="#rift-tower" x="362" y="72"/><use href="#rift-tower" x="622" y="72"/><use href="#rift-tower" x="360" y="350"/><use href="#rift-tower" x="654" y="208"/><use href="#rift-tower" x="881" y="310"/><use href="#rift-tower" x="646" y="474"/><use href="#rift-tower" x="345" y="474"/></g>
      <g transform="translate(116 469)"><circle r="45" fill="#123e50" stroke="#47818c" strokeWidth="2"/><circle r="33" fill="none" stroke="#5ba8b0" strokeDasharray="5 9"/><path d="M0-27 14 0 0 20-14 0Z" fill="#79d4df"/><path d="M0-27V20L-14 0Z" fill="#3d90b5"/></g>
      <g transform="translate(881 95)"><circle r="43" fill="#302944" stroke="#6b608e" strokeWidth="2"/><circle r="31" fill="none" stroke="#9c84af" strokeDasharray="5 9"/><path d="M0-27 14 0 0 20-14 0Z" fill="#bfa0de"/><path d="M0-27V20L-14 0Z" fill="#786cac"/></g>
      <g fill="#a8ceb0" opacity=".45">{[[234,333],[585,114],[450,470],[731,241],[348,192],[535,371],[748,412],[168,386]].map(([x,y],i)=><circle key={i} cx={x} cy={y} r="1.5"/>)}</g>
      <rect width="1000" height="580" fill="url(#rift-mist)"/>
    </svg>
  );
}
