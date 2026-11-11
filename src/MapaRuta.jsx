// src/MapaRuta.jsx
import { useLoadScript, GoogleMap, DirectionsRenderer } from "@react-google-maps/api";
import { useState, useEffect } from "react";

const containerStyle = {
  width: "100%",
  height: "100%",
  minHeight: 400,
  borderRadius: 12
};

// Centro aproximado de Córdoba para el mapa inicial
const center = { lat: 37.888, lng: -4.779 };

function MapaRuta({ origen, destino }) {
  const { isLoaded } = useLoadScript({
    googleMapsApiKey: import.meta.env.VITE_GOOGLE_MAPS_API_KEY,
    libraries: ["places"] // Necesario para que DirectionsService interprete direcciones
  });

  const [directions, setDirections] = useState(null);
  const [error, setError] = useState("");

  useEffect(() => {
    // Si no hay destino o el mapa no está listo, no hacemos nada
    if (!isLoaded || !destino || destino.trim().length < 3) {
      setDirections(null);
      setError("");
      return;
    }

    // Pequeño retardo para no llamar a la API en cada tecla
    const timer = setTimeout(() => {
      const directionsService = new window.google.maps.DirectionsService();

      directionsService.route(
        {
          // Pasamos las direcciones de texto directamente
          origin: origen,
          destination: destino.trim(),
          travelMode: window.google.maps.TravelMode.DRIVING,
        },
        (result, status) => {
          if (status === "OK") {
            setDirections(result);
            setError("");
          } else {
            console.error("Error al calcular la ruta:", status);
            setDirections(null);
            setError("No se pudo encontrar la ruta. Intenta ser más específico con el destino.");
          }
        }
      );
    }, 800);

    return () => clearTimeout(timer);
  }, [isLoaded, origen, destino]);

  if (!isLoaded) {
    return <div style={{ padding: 20, color: "#666" }}>Cargando mapa...</div>;
  }

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      {error && <p style={{ color: "red", fontSize: 13, marginBottom: 6 }}>{error}</p>}
      <div style={{ flex: 1, minHeight: 400 }}>
        <GoogleMap
          mapContainerStyle={containerStyle}
          center={center}
          zoom={12}
        >
          {directions && (
            <DirectionsRenderer
              directions={directions}
              options={{
                polylineOptions: {
                  strokeColor: "#2a7de1",
                  strokeWeight: 5
                },
                suppressMarkers: false // Muestra los marcadores de origen y destino
              }}
            />
          )}
        </GoogleMap>
      </div>
    </div>
  );
}

export default MapaRuta;