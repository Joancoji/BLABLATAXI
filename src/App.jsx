// src/App.jsx
import { useState, useEffect } from "react";
import { auth } from "./firebase";
import { onAuthStateChanged, signOut } from "firebase/auth";
import Auth from "./Auth";
import Viajes from "./Viajes";
import AdminPanel from "./AdminPanel";

// ⚠️ CAMBIA ESTO por el email con el que te registraste como admin
const ADMIN_EMAIL = "joancoji@gmail.com";

function App() {
  const [usuario, setUsuario] = useState(null);
  const [cargando, setCargando] = useState(true);
  const [verAdmin, setVerAdmin] = useState(false);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUsuario(user);
      setCargando(false);
    });
    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await signOut(auth);
    setUsuario(null);
    setVerAdmin(false);
  };

  if (cargando) return <p style={{ padding: 40 }}>Cargando...</p>;

  if (!usuario) return <Auth onLogin={setUsuario} />;

  const esAdmin = usuario.email === ADMIN_EMAIL;

  return (
    <div style={{ fontFamily: "sans-serif" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: 20, borderBottom: "1px solid #eee" }}>
        <h1>🚕 BlaBlaTaxi</h1>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span>{usuario.displayName || usuario.email}</span>
          {esAdmin && (
            <button
              onClick={() => setVerAdmin(!verAdmin)}
              style={{ padding: 8, background: "#333", color: "white", border: "none", borderRadius: 6, cursor: "pointer" }}
            >
              {verAdmin ? "Volver a viajes" : "Panel de admin"}
            </button>
          )}
          <button onClick={handleLogout} style={{ padding: 8, background: "#d93025", color: "white", border: "none", borderRadius: 6, cursor: "pointer" }}>
            Cerrar sesión
          </button>
        </div>
      </div>

      {verAdmin && esAdmin ? <AdminPanel /> : <Viajes />}
    </div>
  );
}

export default App;