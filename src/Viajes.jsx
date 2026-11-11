// src/Viajes.jsx
import { useState, useEffect, useRef } from "react";
import { db, auth } from "./firebase";
import Chat from "./Chat";
import MapaRuta from "./MapaRuta";
import { contienePalabrasProhibidas } from "./filtro";
import { useLoadScript } from "@react-google-maps/api";
import {
  collection,
  addDoc,
  onSnapshot,
  query,
  orderBy,
  serverTimestamp,
  doc,
  updateDoc,
  getDoc,
  getDocs,
  where
} from "firebase/firestore";

const ORIGEN_FIJO = "Estación de Tren de Córdoba – Julio Anguita";
const TARIFA_NORMAL = 1.50;
const TARIFA_ESPECIAL = 1.70;
const SUPLEMENTO_6_PLAZAS = 0.05;
const FESTIVOS = [
  "01-01", "01-06", "05-01", "08-15", "10-12", "11-01", "12-06", "12-08", "12-25",
];
const LIBRERIAS = ["places"];

function esTarifaNormal(fechaStr) {
  if (!fechaStr) return true;
  const fecha = new Date(fechaStr);
  const diaSemana = fecha.getDay();
  const hora = fecha.getHours();
  const mes = String(fecha.getMonth() + 1).padStart(2, "0");
  const dia = String(fecha.getDate()).padStart(2, "0");
  const claveFestivo = `${mes}-${dia}`;
  if (diaSemana === 0 || diaSemana === 6 || FESTIVOS.includes(claveFestivo)) return false;
  return hora >= 6 && hora < 22;
}

function Viajes() {
  const [viajes, setViajes] = useState([]);
  const [destino, setDestino] = useState("");
  const [fecha, setFecha] = useState("");
  const [plazas, setPlazas] = useState(3);
  const [taxi6Plazas, setTaxi6Plazas] = useState(false);
  const [precio, setPrecio] = useState(0);
  const [precioTotal, setPrecioTotal] = useState(0);
  const [distanciaKm, setDistanciaKm] = useState(0);
  const [calculando, setCalculando] = useState(false);
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);
  const [mensaje, setMensaje] = useState("");
  const [chatAbierto, setChatAbierto] = useState(null);
  const [condicionesAbiertas, setCondicionesAbiertas] = useState(false);
  const autocompleteContainerRef = useRef(null);

  const { isLoaded } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: LIBRERIAS
  });

  // Autocompletado moderno
  useEffect(() => {
    if (!isLoaded || !autocompleteContainerRef.current) return;
    if (!window.google?.maps?.places?.PlaceAutocompleteElement) return;

    const autocomplete = new window.google.maps.places.PlaceAutocompleteElement();
    autocompleteContainerRef.current.appendChild(autocomplete);

    const handleSelect = async (event) => {
      const place = event.placePrediction.toPlace();
      await place.fetchFields({ fields: ["formattedAddress", "displayName"] });
      const direccion = place.formattedAddress || place.displayName;
      if (direccion) setDestino(direccion);
    };

    autocomplete.addEventListener("gmp-select", handleSelect);

    return () => {
      autocomplete.removeEventListener("gmp-select", handleSelect);
      if (autocomplete.parentNode === autocompleteContainerRef.current) {
        autocompleteContainerRef.current.removeChild(autocomplete);
      }
    };
  }, [isLoaded]);

  // Lista de viajes abiertos (solo con plazas > 0)
  useEffect(() => {
    const q = query(
      collection(db, "viajes"),
      where("estado", "==", "open"),
      orderBy("fecha", "asc")
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter(v => v.plazasDisponibles > 0);
      setViajes(lista);
    });
    return () => unsubscribe();
  }, []);

  // Calculadora de distancia y precio
  useEffect(() => {
    if (!destino.trim() || destino.trim().length < 3) {
      setPrecio(0);
      setPrecioTotal(0);
      setDistanciaKm(0);
      return;
    }

    const timer = setTimeout(async () => {
      setCalculando(true);
      setError("");
      try {
        const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
        const response = await fetch(
          "https://routes.googleapis.com/directions/v2:computeRoutes",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "X-Goog-Api-Key": apiKey,
              "X-Goog-FieldMask": "routes.distanceMeters"
            },
            body: JSON.stringify({
              origin: { address: ORIGEN_FIJO },
              destination: { address: destino.trim() },
              travelMode: "DRIVE"
            })
          }
        );

        const data = await response.json();
        if (!data.routes || data.routes.length === 0) {
          throw new Error("No se pudo calcular la ruta. Revisa el destino.");
        }

        const km = data.routes[0].distanceMeters / 1000;
        const tarifaBase = esTarifaNormal(fecha) ? TARIFA_NORMAL : TARIFA_ESPECIAL;
        const tarifaFinal = taxi6Plazas ? tarifaBase + SUPLEMENTO_6_PLAZAS : tarifaBase;
        const total = km * tarifaFinal;
        const plazasDivision = taxi6Plazas ? 6 : 4;

        setDistanciaKm(km);
        setPrecioTotal(total);
        setPrecio(total / plazasDivision);
      } catch (err) {
        setError(err.message);
        setPrecio(0);
        setPrecioTotal(0);
        setDistanciaKm(0);
      } finally {
        setCalculando(false);
      }
    }, 800);

    return () => clearTimeout(timer);
  }, [destino, fecha, taxi6Plazas]);

  const crearViaje = async (e) => {
    e.preventDefault();
    setError("");
    setMensaje("");
    setCargando(true);

    try {
      if (!destino.trim() || !fecha) throw new Error("Completa destino y fecha.");
      if (contienePalabrasProhibidas(destino)) throw new Error("El destino contiene palabras no permitidas.");
      if (precio <= 0) throw new Error("Espera a que se calcule el precio o revisa el destino.");

      // Validar mínimo 48 horas de antelación
      const fechaServicio = new Date(fecha);
      const ahora = new Date();
      const diferenciaHoras = (fechaServicio - ahora) / (1000 * 60 * 60);
      if (diferenciaHoras < 48) {
        throw new Error("El viaje debe crearse con al menos 48 horas de antelación.");
      }

      await addDoc(collection(db, "viajes"), {
        origen: ORIGEN_FIJO,
        destino: destino.trim(),
        fecha: new Date(fecha),
        plazasTotales: Number(plazas),
        plazasDisponibles: Number(plazas),
        precioTotal: Number(precioTotal.toFixed(2)),
        precioPorPersona: Number(precio.toFixed(2)),
        distanciaKm: Number(distanciaKm.toFixed(1)),
        taxi6Plazas,
        estado: "open",
        creadorId: auth.currentUser.uid,
        creadorNombre: auth.currentUser.displayName || auth.currentUser.email,
        creadoEn: serverTimestamp()
      });

      // Email a usuarios con destino preferido
      try {
        const usuariosRef = collection(db, "usuarios");
        const q = query(usuariosRef, where("destinosPreferidos", "array-contains", destino.trim()));
        const snapshot = await getDocs(q);
        snapshot.forEach(async (userDoc) => {
          const userData = userDoc.data();
          if (userDoc.id === auth.currentUser.uid) return;
          await addDoc(collection(db, "mail"), {
            to: userData.email,
            message: {
              subject: `🚕 Nuevo viaje a ${destino.trim()}`,
              html: `
                <h2>¡Hay un nuevo viaje que coincide con tus preferencias!</h2>
                <p><strong>Ruta:</strong> ${ORIGEN_FIJO} → ${destino.trim()}</p>
                <p><strong>Fecha:</strong> ${new Date(fecha).toLocaleString()}</p>
                <p><strong>Precio total:</strong> ${precioTotal.toFixed(2)} €</p>
                <p><strong>Precio por persona:</strong> ${precio.toFixed(2)} €</p>
                <p>Entra a BlaBlaTaxi para ver los detalles y apuntarte.</p>
              `
            }
          });
        });
      } catch (emailErr) {
        console.warn("No se pudieron enviar notificaciones por email:", emailErr);
      }

      setDestino("");
      setFecha("");
      setPlazas(3);
      setTaxi6Plazas(false);
      setPrecio(0);
      setPrecioTotal(0);
      setDistanciaKm(0);
      setMensaje("✅ Viaje publicado correctamente.");
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  // RESERVAR (solo el creador)
  const reservarViaje = async (viaje) => {
    setError("");
    setMensaje("");

    try {
      if (viaje.creadorId !== auth.currentUser.uid) {
        throw new Error("Solo el creador puede reservar este servicio.");
      }
      if (viaje.estado !== "open") {
        throw new Error("Este viaje ya no está disponible.");
      }

      await addDoc(collection(db, "reservas"), {
        viajeId: viaje.id,
        usuarioId: auth.currentUser.uid,
        usuarioNombre: auth.currentUser.displayName || auth.currentUser.email,
        origen: viaje.origen,
        destino: viaje.destino,
        fecha: viaje.fecha,
        precioTotal: viaje.precioTotal,
        precioPorPersona: viaje.precioPorPersona,
        distanciaKm: viaje.distanciaKm,
        taxi6Plazas: viaje.taxi6Plazas,
        plazasDivision: viaje.taxi6Plazas ? 6 : 4,
        tipo: "reserva_creador",
        estado: "pendiente",
        fechaReserva: serverTimestamp()
      });

      const viajeRef = doc(db, "viajes", viaje.id);
      await updateDoc(viajeRef, { estado: "reservado", plazasDisponibles: 0 });

      setMensaje("✅ Reserva realizada. El viaje queda cerrado a la espera de validación por el administrador.");
    } catch (err) {
      setError(err.message);
    }
  };

  // UNIRSE (cualquier usuario)
  const unirseAlViaje = async (viaje) => {
    setError("");
    setMensaje("");

    try {
      if (viaje.estado !== "open") {
        throw new Error("Este viaje ya no está disponible.");
      }
      if (viaje.plazasDisponibles <= 0) {
        throw new Error("No quedan plazas disponibles.");
      }

      const yaApuntado = await getDocs(
        query(
          collection(db, "reservas"),
          where("viajeId", "==", viaje.id),
          where("usuarioId", "==", auth.currentUser.uid)
        )
      );
      if (!yaApuntado.empty) throw new Error("Ya estás apuntado a este viaje.");

      // Crear reserva de tipo "unido"
      await addDoc(collection(db, "reservas"), {
        viajeId: viaje.id,
        usuarioId: auth.currentUser.uid,
        usuarioNombre: auth.currentUser.displayName || auth.currentUser.email,
        origen: viaje.origen,
        destino: viaje.destino,
        fecha: viaje.fecha,
        precioTotal: viaje.precioTotal,
        precioPorPersona: viaje.precioPorPersona,
        distanciaKm: viaje.distanciaKm,
        taxi6Plazas: viaje.taxi6Plazas,
        plazasDivision: viaje.taxi6Plazas ? 6 : 4,
        tipo: "unido",
        estado: "pendiente",
        fechaReserva: serverTimestamp()
      });

      // Restar una plaza y cerrar si llega a 0
      const viajeRef = doc(db, "viajes", viaje.id);
      const viajeSnap = await getDoc(viajeRef);
      const nuevasPlazas = viajeSnap.data().plazasDisponibles - 1;

      await updateDoc(viajeRef, {
        plazasDisponibles: nuevasPlazas,
        estado: nuevasPlazas <= 0 ? "completo" : "open"
      });

      if (nuevasPlazas <= 0) {
        setMensaje("✅ Te has unido. El viaje ha quedado completo y ya no aparecerá en la lista.");
      } else {
        setMensaje(`✅ Te has unido al viaje. Quedan ${nuevasPlazas} plazas disponibles.`);
      }
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{ fontFamily: "sans-serif", padding: 20 }}>
      <div style={{ display: "flex", gap: 20, alignItems: "flex-start", marginBottom: 30, flexWrap: "wrap" }}>
        <div style={{ flex: "1 1 450px", minWidth: 350, maxWidth: 600 }}>
          <h2>Publicar un viaje</h2>
          <form onSubmit={crearViaje} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ padding: 10, background: "#f0f0f0", borderRadius: 6, fontSize: 14 }}>
              <strong>Origen:</strong> {ORIGEN_FIJO}
            </div>

            <label style={{ fontSize: 14 }}>
              Fecha y hora del servicio (mínimo 48h de antelación):
              <input
                type="datetime-local"
                value={fecha}
                onChange={(e) => setFecha(e.target.value)}
                style={{ padding: 10, fontSize: 16, width: "100%", marginTop: 4 }}
              />
            </label>

            <label style={{ fontSize: 14 }}>Destino:</label>
            <div ref={autocompleteContainerRef} style={{ width: "100%" }} />

            {destino && (
              <p style={{ fontSize: 14, color: "#333", margin: 0 }}>
                <strong>Destino seleccionado:</strong> {destino}
              </p>
            )}

            {calculando && <p style={{ color: "#666" }}>Calculando distancia...</p>}
            {!calculando && distanciaKm > 0 && (
              <div style={{ padding: 10, background: "#e8f5e9", borderRadius: 6 }}>
                <p style={{ margin: 0, fontSize: 14 }}>
                  Distancia: <strong>{distanciaKm.toFixed(1)} km</strong>
                </p>
                <p style={{ margin: "6px 0 0", fontSize: 16 }}>
                  Precio total del trayecto: <strong>{precioTotal.toFixed(2)} €</strong>
                </p>
                <p style={{ margin: "4px 0 0", fontSize: 18, color: "#2a7de1" }}>
                  Precio por persona ({taxi6Plazas ? 6 : 4} plazas): <strong>{precio.toFixed(2)} €</strong>
                </p>
              </div>
            )}

            <label>
              Plazas disponibles:{" "}
              <input
                type="number"
                min={1}
                max={6}
                value={plazas}
                onChange={(e) => setPlazas(e.target.value)}
                style={{ padding: 6, width: 60 }}
              />
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14 }}>
              <input
                type="checkbox"
                checked={taxi6Plazas}
                onChange={(e) => setTaxi6Plazas(e.target.checked)}
              />
              Taxi hasta 6 plazas
            </label>

            {error && <p style={{ color: "red" }}>{error}</p>}
            {mensaje && <p style={{ color: "green" }}>{mensaje}</p>}

            <button
              type="submit"
              disabled={cargando || calculando}
              style={{
                padding: 12,
                fontSize: 16,
                background: "#2a7de1",
                color: "white",
                border: "none",
                borderRadius: 8,
                cursor: "pointer"
              }}
            >
              {cargando ? "Guardando..." : "Publicar viaje"}
            </button>
          </form>

          {/* Condiciones del servicio colapsables */}
          <div style={{ marginTop: 20 }}>
            <button
              onClick={() => setCondicionesAbiertas(!condicionesAbiertas)}
              style={{
                width: "100%",
                padding: 10,
                background: "#fff8e1",
                border: "1px solid #ffe082",
                borderRadius: 8,
                cursor: "pointer",
                textAlign: "left",
                fontWeight: "bold",
                color: "#5d4037",
                fontSize: 14
              }}
            >
              {condicionesAbiertas ? "▼" : "▶"} ⚠️ Condiciones del servicio
            </button>
            {condicionesAbiertas && (
              <div style={{
                padding: 12,
                background: "#fff8e1",
                border: "1px solid #ffe082",
                borderTop: "none",
                borderRadius: "0 0 8px 8px",
                fontSize: 12,
                color: "#5d4037",
                lineHeight: 1.6
              }}>
                <p style={{ margin: "0 0 8px" }}>
                  <strong>1. Reserva y pago:</strong> El creador del servicio es el único que puede reservarlo. Una vez que los administradores validen el servicio, se le enviará un correo electrónico con los detalles del servicio y el enlace de pago. El creador deberá abonar el <strong>total del trayecto</strong>.
                </p>
                <p style={{ margin: "0 0 8px" }}>
                  <strong>2. Personas unidas:</strong> Las personas que se unan al viaje deberán abonar su parte al creador según el acuerdo al que lleguen. BlaBlaTaxi solo facilita el contacto; no gestiona pagos ni se responsabiliza de los acuerdos entre usuarios.
                </p>
                <p style={{ margin: "0 0 8px" }}>
                  <strong>3. Cancelación:</strong>
                  <br />• Con <strong>24 horas o más</strong> de antelación: cancelación sin coste.
                  <br />• Con <strong>entre 12 y 24 horas</strong> de antelación: se cobrará el <strong>50%</strong> del servicio.
                  <br />• Con <strong>menos de 6 horas</strong> de antelación: el servicio se considerará realizado y se cobrará el <strong>100%</strong>.
                </p>
                <p style={{ margin: "0 0 8px" }}>
                  <strong>4. Creación de viajes:</strong> Los viajes deben crearse con un mínimo de <strong>48 horas</strong> de antelación a la fecha del servicio.
                </p>
                <p style={{ margin: 0 }}>
                  <strong>5. Plazas:</strong> Cuando las plazas disponibles lleguen a 0, el viaje se cerrará automáticamente y no aparecerá en el listado. No se admitirán nuevas uniones.
                </p>
              </div>
            )}
          </div>
        </div>

        <div style={{ flex: "1 1 450px", minWidth: 350, height: 500 }}>
          <MapaRuta origen={ORIGEN_FIJO} destino={destino} />
        </div>
      </div>

      <h2>Viajes disponibles</h2>
      {viajes.length === 0 && <p>No hay viajes disponibles.</p>}
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {viajes.map(v => {
          const esMio = v.creadorId === auth.currentUser.uid;
          return (
            <div key={v.id} style={{ border: "1px solid #ddd", borderRadius: 8, padding: 12 }}>
              <strong>{v.origen} → {v.destino}</strong>
              <p style={{ margin: "4px 0" }}>
                Fecha: {v.fecha?.toDate?.().toLocaleString() || "—"}
              </p>
              <p style={{ margin: "4px 0", fontSize: 14 }}>
                💰 Total: <strong>{v.precioTotal?.toFixed(2)} €</strong> · Por persona:{" "}
                <strong>{v.precioPorPersona?.toFixed(2)} €</strong> ({v.distanciaKm} km)
                {v.taxi6Plazas && <span style={{ fontSize: 12, color: "#2a7de1" }}> · Taxi 6 plazas</span>}
              </p>
              <p style={{ margin: "4px 0" }}>
                Plazas: {v.plazasDisponibles} de {v.plazasTotales} disponibles
              </p>
              <p style={{ margin: "4px 0", fontSize: 12, color: "#666" }}>
                Creado por: {v.creadorNombre}
              </p>

              {esMio ? (
                <button
                  onClick={() => reservarViaje(v)}
                  style={{
                    marginTop: 8,
                    padding: 8,
                    background: "#2a7de1",
                    color: "white",
                    border: "none",
                    borderRadius: 6,
                    cursor: "pointer"
                  }}
                >
                  Reservar mi viaje
                </button>
              ) : (
                <button
                  onClick={() => unirseAlViaje(v)}
                  style={{
                    marginTop: 8,
                    padding: 8,
                    background: "#25D366",
                    color: "white",
                    border: "none",
                    borderRadius: 6,
                    cursor: "pointer"
                  }}
                >
                  Unirme al viaje
                </button>
              )}

              <button
                onClick={() => setChatAbierto(v.id)}
                style={{
                  marginTop: 8,
                  marginLeft: 6,
                  padding: 8,
                  background: "#075E54",
                  color: "white",
                  border: "none",
                  borderRadius: 6,
                  cursor: "pointer"
                }}
              >
                💬 Chat
              </button>
            </div>
          );
        })}
      </div>

      {chatAbierto && <Chat viajeId={chatAbierto} onCerrar={() => setChatAbierto(null)} />}
    </div>
  );
}

export default Viajes;