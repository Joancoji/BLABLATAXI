// src/Auth.jsx
import { useState } from "react";
import { auth } from "./firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile
} from "firebase/auth";

function Auth({ onLogin }) {
  const [modo, setModo] = useState("login"); // "login" o "registro"
  const [nombre, setNombre] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [cargando, setCargando] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setCargando(true);

    try {
      if (modo === "registro") {
        if (!nombre.trim()) {
          throw new Error("Escribe tu nombre");
        }
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: nombre });
        onLogin(userCredential.user);
      } else {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        onLogin(userCredential.user);
      }
    } catch (err) {
      const mensajes = {
        "auth/email-already-in-use": "Ese email ya está registrado. Prueba a iniciar sesión.",
        "auth/invalid-email": "El email no es válido.",
        "auth/weak-password": "La contraseña debe tener al menos 6 caracteres.",
        "auth/user-not-found": "No existe una cuenta con ese email.",
        "auth/wrong-password": "Contraseña incorrecta.",
        "auth/invalid-credential": "Email o contraseña incorrectos."
      };
      setError(mensajes[err.code] || err.message);
    } finally {
      setCargando(false);
    }
  };

  return (
    <div style={{ maxWidth: 400, margin: "60px auto", padding: 24, fontFamily: "sans-serif" }}>
      <h2>{modo === "login" ? "Iniciar sesión" : "Crear cuenta"}</h2>

      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {modo === "registro" && (
          <input
            type="text"
            placeholder="Tu nombre"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            required
            style={{ padding: 10, fontSize: 16 }}
          />
        )}

        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          style={{ padding: 10, fontSize: 16 }}
        />

        <input
          type="password"
          placeholder="Contraseña (mínimo 6 caracteres)"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          minLength={6}
          style={{ padding: 10, fontSize: 16 }}
        />

        {error && <p style={{ color: "red", margin: 0 }}>{error}</p>}

        <button
          type="submit"
          disabled={cargando}
          style={{ padding: 12, fontSize: 16, background: "#2a7de1", color: "white", border: "none", borderRadius: 8, cursor: "pointer" }}
        >
          {cargando ? "Espera..." : modo === "login" ? "Entrar" : "Registrarme"}
        </button>
      </form>

      <p style={{ marginTop: 20, textAlign: "center" }}>
        {modo === "login" ? "¿No tienes cuenta?" : "¿Ya tienes cuenta?"}{" "}
        <button
          type="button"
          onClick={() => { setModo(modo === "login" ? "registro" : "login"); setError(""); }}
          style={{ background: "none", border: "none", color: "#2a7de1", cursor: "pointer", textDecoration: "underline", fontSize: 16 }}
        >
          {modo === "login" ? "Regístrate" : "Inicia sesión"}
        </button>
      </p>
    </div>
  );
}

export default Auth;