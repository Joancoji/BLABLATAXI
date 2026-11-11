// src/AutocompleteNuevo.jsx
import { useEffect, useRef } from "react";

function AutocompleteNuevo({ onPlaceSelected, placeholder }) {
  const containerRef = useRef(null);

  useEffect(() => {
    if (!containerRef.current || !window.google?.maps?.places) return;

    // Crear el nuevo elemento de autocompletado
    const autocomplete = new window.google.maps.places.PlaceAutocompleteElement();
    autocomplete.placeholder = placeholder || "Buscar dirección...";

    // Añadirlo al contenedor de React
    containerRef.current.appendChild(autocomplete);

    // Escuchar cuando el usuario selecciona una dirección
    const handleSelect = async (event) => {
      const place = event.placePrediction.toPlace();
      // Pedir los campos que necesitamos
      await place.fetchFields({
        fields: ["formattedAddress", "displayName", "location"]
      });
      const direccion = place.formattedAddress || place.displayName;
      if (direccion) {
        onPlaceSelected(direccion);
      }
    };

    autocomplete.addEventListener("gmp-select", handleSelect);

    // Limpieza al desmontar
    return () => {
      autocomplete.removeEventListener("gmp-select", handleSelect);
      if (containerRef.current && autocomplete.parentNode === containerRef.current) {
        containerRef.current.removeChild(autocomplete);
      }
    };
  }, [onPlaceSelected, placeholder]);

  return <div ref={containerRef} style={{ width: "100%" }} />;
}

export default AutocompleteNuevo;