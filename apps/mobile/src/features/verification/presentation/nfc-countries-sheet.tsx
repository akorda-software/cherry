import { useCallback, useEffect, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";

import { createVerificationApi } from "@cherry/mobile-shared";

import { Button, LoadingDots, Sheet, Stack, Text, TextField } from "../../../shared/ui";
import { useAuthedApi } from "../../auth/presentation";
import { filterNfcCountries, type NfcCountry, nfcCountryList } from "../domain/nfc-countries";

type CountriesState = { status: "loading" } | { status: "error" } | { status: "ready"; countries: NfcCountry[] };

interface NfcCountriesSheetProps {
  visible: boolean;
  onClose(): void;
}

/**
 * Países cuyos documentos con chip comprueba el servidor por NFC (los de sus certificados CSCA).
 * La lista se pide al abrir la hoja: depende de los certificados que tenga cada instancia.
 */
export function NfcCountriesSheet({ visible, onClose }: NfcCountriesSheetProps) {
  const callApi = useAuthedApi(createVerificationApi);
  const [state, setState] = useState<CountriesState>({ status: "loading" });
  const [query, setQuery] = useState("");

  const load = useCallback(() => {
    setState({ status: "loading" });
    callApi((api) => api.nfcCountries()).then(
      (response) => setState({ status: "ready", countries: nfcCountryList(response.countries) }),
      () => setState({ status: "error" })
    );
  }, [callApi]);

  useEffect(() => {
    if (visible) {
      setQuery("");
      load();
    }
  }, [visible, load]);

  const shown = useMemo(
    () => (state.status === "ready" ? filterNfcCountries(state.countries, query) : []),
    [state, query]
  );

  return (
    <Sheet onClose={onClose} snap="tall" testID="nfc-countries-sheet" title="Países con NFC" visible={visible}>
      <Stack gap="md">
        <Text color="muted">
          Sirven los pasaportes y los documentos de identidad con chip de estos países, en vigor. Si el tuyo no está,
          puedes hacerlo con un selfie.
        </Text>

        {state.status === "loading" ? (
          <View style={styles.center}>
            <LoadingDots accessibilityLabel="Cargando los países" testID="nfc-countries-loading" />
          </View>
        ) : null}

        {state.status === "error" ? (
          <Stack gap="sm">
            <Text>No hemos podido cargar la lista.</Text>
            <Button onPress={load} testID="nfc-countries-retry" variant="secondary">
              Reintentar
            </Button>
          </Stack>
        ) : null}

        {state.status === "ready" ? (
          <>
            <TextField
              autoCapitalize="none"
              autoCorrect={false}
              icon="search"
              label={`Buscar entre ${state.countries.length} países`}
              onChangeText={setQuery}
              testID="nfc-countries-search"
              value={query}
            />
            {shown.length === 0 ? (
              <Text color="muted" testID="nfc-countries-empty">
                Ese país no está en la lista.
              </Text>
            ) : (
              <View accessibilityRole="list" testID="nfc-countries-list">
                {shown.map((country) => (
                  <View key={country.code} style={styles.row}>
                    <Text style={styles.flag}>{country.flag}</Text>
                    <Text style={styles.name}>{country.name}</Text>
                  </View>
                ))}
              </View>
            )}
          </>
        ) : null}
      </Stack>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", paddingVertical: 24 },
  row: { flexDirection: "row", alignItems: "center", gap: 12, paddingVertical: 8 },
  flag: { fontSize: 22, width: 30 },
  name: { flex: 1 }
});
