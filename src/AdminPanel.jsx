// src/AdminPanel.jsx
import { useState, useEffect } from "react";
import { db } from "./firebase";
import {
  collection,
  onSnapshot,
  query,
  orderBy,
  doc,
  updateDoc,
  getDoc
} from "firebase/firestore";

function AdminPanel() {
  const [reservas, setReservas] = useState([]);
  const [mensaje, setMensaje] = useState("");

  useEffect(() => {
    const q = query(collection(db, "reservas"), orderBy("fechaReserva", "desc"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setReservas(lista);
    });
    return () => unsubscribe();
  }, []);

  const validarReserva = async (reserva) => {
    setMensaje("");
    try {
      await updateDoc(doc(db, "reservas", reserva.id), { estado: "validado" });
      if (reserva.viajeId) {
        const viajeRef = doc(db, "viajes", reserva.viajeId);
        const viajeSnap = await getDoc(viajeRef);
        if (viajeSnap.exists()) {
          await updateDoc(viajeRef, { estado: "validado" });
        }
      }
      setMensaje("✅ Reserva validada correctamente.");
    } catch (err) {
      setMensaje("❌ Error al validar: " + err.message);
    }
  };

  const cancelarReserva = async (reserva) => {
    setMensaje("");
    try {
      await updateDoc(doc(db, "reservas", reserva.id), { estado: "cancelado" });
      if (reserva.viajeId) {
        const viajeRef = doc(db, "viajes", reserva.viajeId);
        const viajeSnap = await getDoc(viajeRef);
        if (viajeSnap.exists()) {
          await updateDoc(viajeRef, {
            estado: "open",
            plazasDisponibles: viajeSnap.data().plazasTotales
          });
        }
      }
      setMensaje("✅ Reserva cancelada. El viaje vuelve a estar disponible.");
    } catch (err) {
      setMensaje("❌ Error al cancelar: " + err.message);
    }
  };

  return (
    <div style={{ padding: 20, fontFamily: "sans-serif" }}>
      <h2>📋 Panel de administrador · Reservas</h2>
      {mensaje && <p style={{ color: mensaje.startsWith("✅") ? "green" : "red" }}>{mensaje}</p>}
      {reservas.length === 0 && <p>No hay reservas todavía.</p>}
      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 14 }}>
          <thead>
            <tr style={{ background: "#f0f0f0" }}>
              <th style={{ padding: 8, border: "1px solid #ddd", textAlign: "left" }}>Fecha servicio</th>
              <th style={{ padding: 8, border: "1px solid #ddd", textAlign: "left" }}>Origen</th>
              <th style={{ padding: 8, border: "1px solid #ddd", textAlign: "left" }}>Destino</th>
              <th style={{ padding: 8, border: "1px solid #ddd", textAlign: "left" }}>Precio total</th>
              <th style={{ padding: 8, border: "1px solid #ddd", textAlign: "left" }}>Por persona</th>
              <th style={{ padding: 8, border: "1px solid #ddd", textAlign: "left" }}>Plazas</th>
              <th style={{ padding: 8, border: "1px solid #ddd", textAlign: "left" }}>Tipo</th>
              <th style={{ padding: 8, border: "1px solid #ddd", textAlign: "left" }}>Reservado por</th>
              <th style={{ padding: 8, border: "1px solid #ddd", textAlign: "left" }}>Estado</th>
              <th style={{ padding: 8, border: "1px solid #ddd", textAlign: "left" }}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {reservas.map(r => (
              <tr key={r.id}>
                <td style={{ padding: 8, border: "1px solid #ddd" }}>
                  {r.fecha?.toDate?.().toLocaleString() || "—"}
                </td>
                <td style={{ padding: 8, border: "1px solid #ddd" }}>{r.origen}</td>
                <td style={{ padding: 8, border: "1px solid #ddd" }}>{r.destino}</td>
                <td style={{ padding: 8, border: "1px solid #ddd" }}>{r.precioTotal?.toFixed(2)} €</td>
                <td style={{ padding: 8, border: "1px solid #ddd" }}>{r.precioPorPersona?.toFixed(2)} €</td>
                <td style={{ padding: 8, border: "1px solid #ddd" }}>
                  {r.plazasDivision === 6 ? "6 plazas" : "4 plazas"}
                </td>
                <td style={{ padding: 8, border: "1px solid #ddd" }}>
                  {r.tipo === "reserva_creador" ? "Reserva (creador)" : "Unido"}
                </td>
                <td style={{ padding: 8, border: "1px solid #ddd" }}>{r.usuarioNombre}</td>
                <td style={{ padding: 8, border: "1px solid #ddd" }}>
                  <span style={{
                    padding: "2px 8px",
                    borderRadius: 12,
                    fontSize: 12,
                    background: r.estado === "validado" ? "#e8f5e9" : r.estado === "cancelado" ? "#ffebee" : "#fff8e1",
                    color: r.estado === "validado" ? "green" : r.estado === "cancelado" ? "red" : "#b26a00"
                  }}>
                    {r.estado || "pendiente"}
                  </span>
                </td>
                <td style={{ padding: 8, border: "1px solid #ddd" }}>
                  {r.estado !== "validado" && r.estado !== "cancelado" && (
                    <>
                      <button
                        onClick={() => validarReserva(r)}
                        style={{ padding: 6, marginRight: 4, background: "#2a7de1", color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12 }}
                      >
                        Validar
                      </button>
                      <button
                        onClick={() => cancelarReserva(r)}
                        style={{ padding: 6, background: "#d93025", color: "white", border: "none", borderRadius: 4, cursor: "pointer", fontSize: 12 }}
                      >
                        Cancelar
                      </button>
                    </>
                  )}
                  {r.estado === "validado" && <span style={{ fontSize: 12, color: "green" }}>✓ Validado</span>}
                  {r.estado === "cancelado" && <span style={{ fontSize: 12, color: "red" }}>✗ Cancelado</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default AdminPanel;