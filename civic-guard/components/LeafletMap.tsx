"use client";

import React, { useEffect, useRef, useMemo, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet.heat";
import "leaflet.markercluster";
import "leaflet.markercluster/dist/MarkerCluster.css";
import "leaflet.markercluster/dist/MarkerCluster.Default.css";
import Dock from "./ui/Dock";
import CardNav from "./ui/CardNav";

interface Report {
  id: string;
  title: string;
  description: string;
  category: string;
  severity_score: number;
  latitude: number;
  longitude: number;
  image_url: string;
  status: string;
  created_at: string;
}

interface LeafletMapProps {
  reports: Report[];
  viewMode?: "active" | "resolved";
  focusCoords?: { lat: number; lng: number } | null;
  emphasizedSeverity?: number | null;
}

// Helper to get marker color based on severity or resolved status
const getMarkerColor = (report: Report, viewMode: string) => {
  if (viewMode === "resolved" || report.status === "Resolved") {
    return "#10b981"; // emerald-500
  }
  if (report.severity_score <= 2) return "#06b6d4"; // cyan-500
  if (report.severity_score <= 3) return "#f59e0b"; // amber-500
  return "#ef4444"; // red-500
};

type MapStyleName = "dark" | "cyberpunk" | "satellite";

const MAP_TILES = {
  dark: {
    url: "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    filter: "none"
  },
  cyberpunk: {
    url: "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    filter: "invert(100%) hue-rotate(180deg) saturate(300%) contrast(150%) brightness(80%)"
  },
  satellite: {
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    filter: "saturate(120%) contrast(110%)"
  }
};

export default function LeafletMap({ reports: allReports, viewMode = "active", focusCoords = null, emphasizedSeverity = null }: LeafletMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const tileLayerRef = useRef<L.TileLayer | null>(null);
  const markersRef = useRef<{ [key: string]: L.Marker }>({});
  const heatLayerRef = useRef<any>(null); // Use any for heat layer type to avoid ts errors if incomplete types
  const markerClusterGroupRef = useRef<any>(null);
  
  const [showHeatmap, setShowHeatmap] = useState(false);
  const [tourActive, setTourActive] = useState(false);
  const tourIndexRef = useRef(0);
  const [mapStyle, setMapStyle] = useState<MapStyleName>("dark");
  
  // Time-Lapse State
  const [timeLapseActive, setTimeLapseActive] = useState(false);
  const [currentTime, setCurrentTime] = useState<number>(Date.now());
  const [isPlaying, setIsPlaying] = useState(false);

  // Calculate min and max times
  const timeRange = useMemo(() => {
    if (allReports.length === 0) return { min: Date.now(), max: Date.now() };
    const times = allReports.map(r => new Date(r.created_at).getTime()).filter(t => !isNaN(t));
    if (times.length === 0) return { min: Date.now(), max: Date.now() };
    const min = Math.min(...times);
    const max = Math.max(...times);
    return { min, max: max === min ? max + 1000 : max };
  }, [allReports]);

  // When time lapse activates, set current time to min
  useEffect(() => {
    if (timeLapseActive) {
      setCurrentTime(timeRange.min);
      setIsPlaying(true);
    } else {
      setIsPlaying(false);
    }
  }, [timeLapseActive, timeRange.min]);

  // Playback loop
  useEffect(() => {
    if (!isPlaying || !timeLapseActive) return;
    
    const durationMs = 8000; // 8 seconds to play through
    const stepMs = 50; 
    const totalRange = timeRange.max - timeRange.min;
    const increment = (totalRange / durationMs) * stepMs;

    const interval = setInterval(() => {
      setCurrentTime(prev => {
        const next = prev + increment;
        if (next >= timeRange.max) {
          setIsPlaying(false);
          return timeRange.max;
        }
        return next;
      });
    }, stepMs);

    return () => clearInterval(interval);
  }, [isPlaying, timeLapseActive, timeRange]);

  const reports = useMemo(() => {
    if (!timeLapseActive) return allReports;
    return allReports.filter(r => new Date(r.created_at).getTime() <= currentTime);
  }, [allReports, timeLapseActive, currentTime]);

  // Compute the default center for when there are no reports
  const defaultCenter = useMemo<[number, number]>(() => [12.9716, 79.1595], []);

  // Initialize the map once
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    mapRef.current = L.map(mapContainerRef.current, {
      zoomControl: true,
      attributionControl: false,
    }).setView(defaultCenter, 14);

    tileLayerRef.current = L.tileLayer(MAP_TILES.dark.url, {
      maxZoom: 19,
    }).addTo(mapRef.current);

    markerClusterGroupRef.current = (L as any).markerClusterGroup({
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
      zoomToBoundsOnClick: true,
      maxClusterRadius: 50,
    }).addTo(mapRef.current);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        markerClusterGroupRef.current = null;
        tileLayerRef.current = null;
        markersRef.current = {};
      }
    };
  }, [defaultCenter]);

  // Update map style tiles and CSS filters
  useEffect(() => {
    if (tileLayerRef.current) {
      tileLayerRef.current.setUrl(MAP_TILES[mapStyle].url);
      const container = tileLayerRef.current.getContainer();
      if (container) {
        container.style.filter = MAP_TILES[mapStyle].filter;
        container.style.transition = "filter 0.8s ease";
      }
    }
  }, [mapStyle]);

  // Fit bounds when reports change
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (reports.length > 0) {
      const bounds = L.latLngBounds(
        reports.map((r) => [r.latitude, r.longitude] as [number, number])
      );
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 15 });
    } else {
      map.setView(defaultCenter, 14);
    }
  }, [reports, defaultCenter]);

  // Fly to focused coordinates
  useEffect(() => {
    if (!focusCoords) return;

    // Small timeout to let layout settle before flying
    const timeoutId = setTimeout(() => {
      const map = mapRef.current;
      if (!map) return;

      // Invalidate size in case the map was hidden (e.g. on mobile) and just became visible
      map.invalidateSize();

      try {
        map.flyTo([focusCoords.lat, focusCoords.lng], 16, {
          animate: true,
          duration: 1.5,
        });

        // Open the popup for the matching marker
        Object.values(markersRef.current).forEach((marker) => {
          const latlng = marker.getLatLng();
          if (
            Math.abs(latlng.lat - focusCoords.lat) < 0.0001 &&
            Math.abs(latlng.lng - focusCoords.lng) < 0.0001
          ) {
            setTimeout(() => marker.openPopup(), 1500);
          }
        });
      } catch (e) {
        console.warn("Leaflet flyTo failed (likely layout shift), falling back to setView", e);
        map.setView([focusCoords.lat, focusCoords.lng], 16);
      }
    }, 150);

    return () => clearTimeout(timeoutId);
  }, [focusCoords]);

  // Sync markers when reports, viewMode, or emphasizedSeverity changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    // Clear old markers that are no longer in the reports list
    const currentReportIds = new Set(reports.map((r) => r.id));
    Object.keys(markersRef.current).forEach((id) => {
      if (!currentReportIds.has(id)) {
        const old = markersRef.current[id];
        if ((old as any)._isBypassingCluster) {
          old.remove(); // safely remove directly from map
        } else if (markerClusterGroupRef.current) {
          markerClusterGroupRef.current.removeLayer(old); // safely remove from cluster
        }
        delete markersRef.current[id];
      }
    });

    // Add or update markers for current reports
    reports.forEach((report) => {
      const color = getMarkerColor(report, viewMode);
      
      let isEmphasized = false;
      if (emphasizedSeverity !== null) {
        if (emphasizedSeverity === 1 && report.severity_score <= 2) isEmphasized = true;
        else if (emphasizedSeverity === 2 && report.severity_score === 3) isEmphasized = true;
        else if (emphasizedSeverity === 3 && report.severity_score >= 4) isEmphasized = true;
      }

      const scale = isEmphasized ? "scale(2.5)" : "scale(1)";
      const zIndexOffset = isEmphasized ? 1000 : 0;
      const transitionStyle = "transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);";

      const markerHtml = `
        <div style="position: relative; width: 30px; height: 30px; display: flex; align-items: center; justify-content: center; transform: ${scale}; ${transitionStyle} transform-origin: center bottom;">
          <div class="marker-inner" style="position: relative; display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);">
            
            <!-- Hover ripple element -->
            <div class="marker-ripple" style="background-color: ${color};"></div>
            
            <!-- Marker Icon -->
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="z-index: 2; position: relative; filter: drop-shadow(0px 3px 4px rgba(0,0,0,0.4));">
              <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z" 
                    fill="${color}" 
                    stroke="#020617" 
                    stroke-width="1.5"
              />
            </svg>
            
            <!-- Default subtle ping -->
            <span style="
              position: absolute; 
              width: 10px; 
              height: 10px; 
              background-color: ${color}; 
              border-radius: 50%; 
              opacity: 0.75; 
              animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
              z-index: 1;
            "></span>
          </div>
        </div>
      `;

      const customIcon = L.divIcon({
        html: markerHtml,
        className: "custom-marker-icon",
        iconSize: [30, 30],
        iconAnchor: [15, 30],
      });

      const statusLabel = report.status === "Resolved"
        ? `<span style="color: #10b981; font-weight: bold;">✓ Resolved</span>`
        : `<span style="color: ${color}; font-weight: bold;">${report.category}</span>`;
        
      const popupContent = `
        <div style="font-family: inherit; padding: 4px;">
          <h3 style="margin: 0 0 4px 0; font-size: 15px; font-weight: 700; color: #f1f5f9; line-height: 1.3;">${report.title}</h3>
          <p style="margin: 0 0 8px 0; font-size: 12px; color: #94a3b8;">${statusLabel}</p>
          ${
            report.image_url
              ? `<img src="${report.image_url}" style="width: 100%; height: 120px; object-fit: cover; border-radius: 6px; margin-bottom: 8px;" alt="Issue" />`
              : ""
          }
          <p style="margin: 0; font-size: 13px; color: #cbd5e1; line-height: 1.5; overflow: visible;">${report.description}</p>
        </div>
      `;

      let forceRecreate = false;
      const shouldBypassCluster = isEmphasized || tourActive || timeLapseActive;

      if (markersRef.current[report.id]) {
        const wasBypassingCluster = (markersRef.current[report.id] as any)._isBypassingCluster;
        if (shouldBypassCluster !== wasBypassingCluster) {
          forceRecreate = true;
        }
      }

      if (markersRef.current[report.id] && !forceRecreate) {
        // Update existing marker instead of recreating it so popups stay open!
        const existingMarker = markersRef.current[report.id];
        existingMarker.setIcon(customIcon);
        existingMarker.setZIndexOffset(zIndexOffset);
        
        // Update popup content just in case status changed
        const popup = existingMarker.getPopup();
        if (popup) {
          popup.setContent(popupContent);
        }
      } else {
        // Cleanup old marker if we are force-recreating
        if (markersRef.current[report.id]) {
          const old = markersRef.current[report.id];
          if ((old as any)._isBypassingCluster) {
            old.remove();
          } else if (markerClusterGroupRef.current) {
            markerClusterGroupRef.current.removeLayer(old);
          }
          delete markersRef.current[report.id];
        }

        // Create new marker
        const marker = L.marker([report.latitude, report.longitude], {
          icon: customIcon,
          zIndexOffset,
        });

        marker.bindPopup(popupContent);

        if (shouldBypassCluster) {
          // Bypass clustering so the marker always pops out visibly
          marker.addTo(map);
        } else if (markerClusterGroupRef.current) {
          markerClusterGroupRef.current.addLayer(marker);
        } else {
          marker.addTo(map);
        }
        
        (marker as any)._isBypassingCluster = shouldBypassCluster;
        markersRef.current[report.id] = marker;

        marker.on("click", (e) => {
          const latlng = e.target.getLatLng();
          const targetPoint = map.project(latlng, map.getZoom()).subtract([0, 150]);
          const targetLatLng = map.unproject(targetPoint, map.getZoom());
          map.flyTo(targetLatLng, map.getZoom(), {
            animate: true,
            duration: 0.6,
          });
        });
      }
    });

  }, [reports, viewMode, focusCoords, emphasizedSeverity, tourActive, timeLapseActive]);

  // Dynamic re-framing on filter
  useEffect(() => {
    const map = mapRef.current;
    if (!map || emphasizedSeverity === null) return;

    const emphasizedReports = reports.filter((report) => {
      if (emphasizedSeverity === 1 && report.severity_score <= 2) return true;
      if (emphasizedSeverity === 2 && report.severity_score === 3) return true;
      if (emphasizedSeverity === 3 && report.severity_score >= 4) return true;
      return false;
    });

    if (emphasizedReports.length > 0) {
      const bounds = L.latLngBounds(
        emphasizedReports.map((r) => [r.latitude, r.longitude] as [number, number])
      );
      map.flyToBounds(bounds, { padding: [50, 50], maxZoom: 15, duration: 1.2 });
    }
  }, [emphasizedSeverity, reports]);

  // Heatmap effect
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    if (showHeatmap && isMapVisible) {
      // Create heat layer data. Intensity based on severity score.
      const heatData = reports.map((r) => [
        r.latitude, 
        r.longitude, 
        r.severity_score >= 4 ? 1.0 : r.severity_score === 3 ? 0.6 : 0.3
      ]);

      heatLayerRef.current = (L as any).heatLayer(heatData, {
        radius: 35,
        blur: 25,
        maxZoom: 15,
        gradient: {
          0.4: '#3b82f6', // blue
          0.6: '#2dd4bf', // teal
          0.8: '#f59e0b', // amber
          1.0: '#ef4444'  // red
        }
      }).addTo(map);

      // Make markers very subtle so the heatmap pops
      Object.values(markersRef.current).forEach((m) => {
        m.setOpacity(0.15);
      });
    } else {
      if (heatLayerRef.current) {
        map.removeLayer(heatLayerRef.current);
        heatLayerRef.current = null;
      }
      // Restore markers
      Object.values(markersRef.current).forEach((m) => {
        m.setOpacity(1.0);
      });
    }
    
    return () => {
      if (heatLayerRef.current && map) {
        map.removeLayer(heatLayerRef.current);
        heatLayerRef.current = null;
      }
    };
  }, [showHeatmap, reports]);

  // Tour Mode effect
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !tourActive || reports.length === 0) return;

    let timeoutId: NodeJS.Timeout;

    const playNext = () => {
      if (tourIndexRef.current >= reports.length) {
        tourIndexRef.current = 0;
      }
      
      const report = reports[tourIndexRef.current];
      const marker = markersRef.current[report.id];

      if (marker) {
        const latlng = marker.getLatLng();
        
        // Offset the center so the popup fits
        const targetPoint = map.project(latlng, map.getZoom()).subtract([0, 150]);
        const targetLatLng = map.unproject(targetPoint, map.getZoom());

        map.flyTo(targetLatLng, map.getZoom(), {
          animate: true,
          duration: 1.5,
        });

        // Delay popup open so it happens right after flight
        setTimeout(() => {
          if (tourActive && mapRef.current && markerClusterGroupRef.current) {
            try {
              markerClusterGroupRef.current.zoomToShowLayer(marker, () => {
                marker.openPopup();
              });
            } catch (error) {
              // Fallback if marker is not properly clustered or has no parent
              marker.openPopup();
            }
          }
        }, 1500);
      }

      tourIndexRef.current++;
      // Wait 6 seconds before moving to next
      timeoutId = setTimeout(playNext, 6000);
    };

    playNext();

    return () => {
      clearTimeout(timeoutId);
      map.closePopup();
    };
  }, [tourActive, reports]);

  // Clean up map instance on unmount
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  const [isMapVisible, setIsMapVisible] = useState(true);

  // Resize handler using ResizeObserver to perfectly track visibility (display:none)
  useEffect(() => {
    if (!mapContainerRef.current) return;
    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        if (width === 0 || height === 0) {
          setIsMapVisible(false);
        } else {
          setIsMapVisible(true);
          if (mapRef.current) {
            mapRef.current.invalidateSize();
          }
        }
      }
    });

    observer.observe(mapContainerRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div className="relative w-full h-full">
      <div ref={mapContainerRef} className="w-full h-full z-0" style={{ backgroundColor: "#0a0a0a" }} />
      
      {/* Map Tools Nav (Replaces Map Controls Dock) */}
      <div className="fixed bottom-[130px] right-6 md:absolute md:top-4 md:right-4 md:bottom-auto md:left-auto md:translate-x-0 z-[400]">
        <CardNav
          items={[
            {
              label: "Map Features",
              bgColor: "#0f172a", // slate-900
              textColor: "#f8fafc", // slate-50
              links: [
                { 
                  label: "Tour Mode", 
                  ariaLabel: "Toggle Tour Mode", 
                  isActive: tourActive,
                  onClick: () => {
                    setTourActive(!tourActive);
                    if (!tourActive) tourIndexRef.current = 0;
                  }
                },
                { 
                  label: "Heatmap", 
                  ariaLabel: "Toggle Heatmap", 
                  isActive: showHeatmap,
                  onClick: () => setShowHeatmap(!showHeatmap) 
                },
                { 
                  label: "Time-Lapse", 
                  ariaLabel: "Toggle Time Lapse", 
                  isActive: timeLapseActive,
                  onClick: () => setTimeLapseActive(!timeLapseActive) 
                }
              ]
            },
            {
              label: "Map Theme",
              bgColor: "#1e1b4b", // indigo-950
              textColor: "#e0e7ff",
              links: [
                { 
                  label: "Dark Mode", 
                  isActive: mapStyle === "dark",
                  onClick: () => setMapStyle("dark") 
                },
                { 
                  label: "Cyberpunk", 
                  isActive: mapStyle === "cyberpunk",
                  onClick: () => setMapStyle("cyberpunk") 
                },
                { 
                  label: "Satellite", 
                  isActive: mapStyle === "satellite",
                  onClick: () => setMapStyle("satellite") 
                }
              ]
            }
          ]}
          buttonBgColor="#10b981" // emerald-500
          buttonTextColor="#020617" // slate-950
        />
      </div>

      {/* Time Lapse Player Panel */}
      {timeLapseActive && (
        <div className="absolute top-6 left-1/2 -translate-x-1/2 z-[400] w-[90%] max-w-md p-4 rounded-2xl bg-slate-950/80 backdrop-blur-xl border border-indigo-500/30 shadow-[0_0_30px_rgba(99,102,241,0.2)] flex flex-col gap-3 transition-all">
          <div className="flex justify-between items-center px-1">
            <span className="text-xs font-bold text-indigo-400 uppercase tracking-widest">Time-Lapse</span>
            <span className="text-sm font-mono font-medium text-slate-200">
              {new Date(currentTime).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
            </span>
          </div>
          
          <div className="flex items-center gap-3">
            <button 
              onClick={() => setIsPlaying(!isPlaying)}
              className="shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 hover:bg-indigo-500/40 transition-colors"
            >
              {isPlaying ? (
                <span className="w-3 h-3 bg-current rounded-sm"></span>
              ) : (
                <svg className="w-4 h-4 ml-1" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>
              )}
            </button>
            
            <input 
              type="range"
              min={timeRange.min}
              max={timeRange.max}
              value={currentTime}
              onChange={(e) => {
                 setCurrentTime(Number(e.target.value));
                 setIsPlaying(false);
              }}
              className="w-full accent-indigo-500 bg-slate-800 h-2 rounded-full appearance-none cursor-pointer"
            />
          </div>
        </div>
      )}
      
      {/* Inject ping animation keyframes style tag */}
      <style>{`
        @keyframes ping {
          75%, 100% {
            transform: scale(2.5);
            opacity: 0;
          }
        }
        @keyframes ripple {
          0% {
            transform: scale(0.8);
            opacity: 0.7;
          }
          100% {
            transform: scale(2.8);
            opacity: 0;
          }
        }
        .marker-inner {
          cursor: pointer;
        }
        .marker-inner:hover {
          transform: translateY(-4px) scale(1.1) !important;
        }
        .marker-ripple {
          position: absolute;
          width: 24px;
          height: 24px;
          border-radius: 50%;
          opacity: 0;
          z-index: 0;
        }
        .marker-inner:hover .marker-ripple {
          animation: ripple 1.2s infinite cubic-bezier(0.25, 0.46, 0.45, 0.94);
        }
        .custom-marker-icon {
          background: transparent;
          border: none;
        }
        @keyframes popup-bounce {
          0% {
            opacity: 0;
            margin-bottom: -20px;
          }
          60% {
            opacity: 1;
            margin-bottom: 8px;
          }
          100% {
            opacity: 1;
            margin-bottom: 0;
          }
        }
        .leaflet-popup {
          opacity: 0;
          animation: popup-bounce 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
          animation-delay: 0.2s;
        }
        .leaflet-popup-content-wrapper {
          background-color: #0f172a !important;
          border: 1px solid #334155 !important;
          border-radius: 0.75rem !important;
          color: #f8fafc !important;
        }
        .leaflet-popup-tip {
          background-color: #0f172a !important;
          border-left: 1px solid #334155 !important;
          border-bottom: 1px solid #334155 !important;
        }
        
        /* Custom Marker Cluster Theme */
        .marker-cluster-small { background-color: rgba(6, 182, 212, 0.5) !important; }
        .marker-cluster-small div { background-color: rgba(6, 182, 212, 0.85) !important; color: white !important; font-weight: bold; border-radius: 50%; }
        .marker-cluster-medium { background-color: rgba(245, 158, 11, 0.5) !important; }
        .marker-cluster-medium div { background-color: rgba(245, 158, 11, 0.85) !important; color: white !important; font-weight: bold; border-radius: 50%; }
        .marker-cluster-large { background-color: rgba(239, 68, 68, 0.5) !important; }
        .marker-cluster-large div { background-color: rgba(239, 68, 68, 0.85) !important; color: white !important; font-weight: bold; border-radius: 50%; }
      `}</style>
    </div>
  );
}
