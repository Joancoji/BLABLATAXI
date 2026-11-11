// src/Chat.jsx
import { useState, useEffect } from "react";
import { db, auth } from "./firebase";
import {
  collection,
  query,
  where,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp
} from "firebase/firestore";
import { contienePalabrasProhibidas, censurarTexto } from "./filtro";

function Chat({ viajeId, onCerrar }) {
  const [mensajes, setMensajes] = useState([]);
  const [nuevoMensaje, setNuevoMensaje] = useState("");
  const [error, setError] = useState("");

  // Escucha los mensajes del viaje en tiempo real
  useEffect(() => {
    if (!viajeId) return;

    const q = query(
      collection(db, "mensajes"),
      where("viajeId", "==", viajeId),
      orderBy("timestamp", "asc")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const lista = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setMensajes(lista);
    });

    return () => unsubscribe();
  }, [viajeId]);

  const enviarMensaje = async (e) => {
    e.preventDefault();
    setError("");
    const texto = nuevoMensaje.trim();
    // Comprobar si hay palabras malsonantes
if (contienePalabrasProhibidas(texto)) {
  setError("Tu mensaje contiene palabras no permitidas. Reformúlalo.");
  return;
}
    if (!texto) return;

    try {
      await addDoc(collection(db, "mensajes"), {
        viajeId: viajeId,
        texto: censurarTexto(texto),
        usuarioId: auth.currentUser.uid,
        usuarioNombre: auth.currentUser.displayName || auth.currentUser.email,
        timestamp: serverTimestamp()
      });
      setNuevoMensaje("");
    } catch (err) {
      setError(err.message);
    }
  };

  return (
    <div style={{
      position: "fixed",
      bottom: 20,
      right: 20,
      width: 350,
      maxHeight: 500,
      background: "white",
      border: "1px solid #ddd",
      borderRadius: 12,
      boxShadow: "0 10px 30px rgba(0,0,0,0.2)",
      display: "flex",
      flexDirection: "column",
      fontFamily: "sans-serif",
      zIndex: 1000
    }}>
      <div style={{
        padding: 12,
        borderBottom: "1px solid #eee",
        display: "flex",
        justifyContent: "space-between",
        alignItems: "center"
      }}>
        <strong>💬 Chat del viaje</strong>
        <button
          onClick={onCerrar}
          style={{ background: "none", border: "none", fontSize: 18, cursor: "pointer" }}
        >
          ✕
        </button>
      </div>

      <div style={{
        flex: 1,
        overflowY: "auto",
        padding: 12,
        display: "flex",
        flexDirection: "column",
        gap: 8,
        minHeight: 200
      }}>
        {mensajes.length === 0 && (
          <p style={{ color: "#999", fontSize: 13, textAlign: "center" }}>
            No hay mensajes todavía. ¡Escribe el primero!
          </p>
        )}
        {mensajes.map(m => {
          const esMio = m.usuarioId === auth.currentUser.uid;
          return (
            <div
              key={m.id}
              style={{
                alignSelf: esMio ? "flex-end" : "flex-start",
                maxWidth: "80%"
              }}
            >
              <div style={{ fontSize: 10, color: "#999", marginBottom: 2 }}>
                {m.usuarioNombre}
              </div>
              <div style={{
                padding: "8px 12px",
                borderRadius: 12,
                background: esMio ? "#2a7de1" : "#f1f1f1",
                color: esMio ? "white" : "black",
                fontSize: 14
              }}>
                {m.texto}
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={enviarMensaje} style={{
        padding: 10,
        borderTop: "1px solid #eee",
        display: "flex",
        gap: 6
      }}>
        <input
          type="text"
          placeholder="Escribe un mensaje..."
          value={nuevoMensaje}
          onChange={(e) => setNuevoMensaje(e.target.value)}
          style={{ flex: 1, padding: 8, borderRadius: 6, border: "1px solid #ddd" }}
        />
        <button
          type="submit"
          style={{ padding: "8px 12px", background: "#2a7de1", color: "white", border: "none", borderRadius: 6, cursor: "pointer" }}
        >
          ➤
        </button>
      </form>

      {error && <p style={{ color: "red", fontSize: 12, padding: "0 10px 10px" }}>{error}</p>}
    </div>
  );
}

export default Chat;