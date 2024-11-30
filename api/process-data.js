

export default async function handler(req, res) {
  const { storeUrl, documentKey, first_name, last_name, email, phone, timestamp } = req.body;

  // Überprüfung des AUTH_TOKEN aus Umgebungsvariablen
  const authToken = process.env.AUTH_TOKEN;
  const requestAuthToken = req.headers.authorization?.split("Bearer ")[1];

  if (!authToken || requestAuthToken !== authToken) {
    return res.status(401).json({
      status: "error",
      message: "Unauthorized. Invalid or missing AUTH_TOKEN.",
    });
  }

  if (!storeUrl || !documentKey) {
    return res.status(400).json({
      status: "error",
      message: "storeUrl and documentKey are required",
    });
  }

  // URLs
  const writeUrl = `${storeUrl}/${documentKey}`;
  const readUrl = `${storeUrl}/${documentKey}`;
  const currentTimestamp = timestamp || Date.now();

  console.log("Starte GET-Request für bestehende Daten...");
  console.log("Lese URL:", readUrl);

  let existingData;

  try {
    // GET-Request für bestehende Daten
    const response = await fetch(readUrl, { method: "GET" });
    const data = await response.json();

    existingData = data.data?.user_data || {
      emails: {},
      phones: {},
      names: {},
      current_data: {}, // Falls current_data nicht existiert
    };
    console.log(
      "Bestehende Daten aus der Datenbank:",
      JSON.stringify(existingData, null, 2)
    );
  } catch (error) {
    console.error("Fehler beim Abrufen bestehender Daten:", error);
    return res.status(500).json({
      status: "error",
      message: "Fehler beim Abrufen bestehender Daten",
    });
  }

  // Zusammenführen der neuen und bestehenden Daten
  const updatedEmails = { ...existingData.emails };
  if (email && !updatedEmails[email]) {
    updatedEmails[email] = { timestamp: currentTimestamp };
    console.log("Neue Email hinzugefügt:", email);
  }

  const updatedPhones = { ...existingData.phones };
  if (phone && !updatedPhones[phone]) {
    updatedPhones[phone] = { timestamp: currentTimestamp };
    console.log("Neue Telefonnummer hinzugefügt:", phone);
  }

  const fullName = `${first_name || ""} ${last_name || ""}`.trim();
  const updatedNames = { ...existingData.names };
  if (fullName && !updatedNames[fullName]) {
    updatedNames[fullName] = { timestamp: currentTimestamp };
    console.log("Neuer Name hinzugefügt:", fullName);
  }

  // Aktualisiere current_data mit den neuesten Werten
  const updatedCurrentData = {
    email: email || existingData.current_data.email || "",
    phone: phone || existingData.current_data.phone || "",
    name: fullName || existingData.current_data.name || "",
    timestamp: currentTimestamp,
  };

  // Zusammengeführte Daten
  const updatedData = {
    emails: updatedEmails,
    phones: updatedPhones,
    names: updatedNames,
    current_data: updatedCurrentData,
  };

  console.log(
    "Zusammengeführte und deduplizierte Daten:",
    JSON.stringify(updatedData, null, 2)
  );

  // Vergleich der zusammengeführten Daten mit den bestehenden Daten
  const dataHasChanged =
    JSON.stringify(existingData.emails) !== JSON.stringify(updatedEmails) ||
    JSON.stringify(existingData.phones) !== JSON.stringify(updatedPhones) ||
    JSON.stringify(existingData.names) !== JSON.stringify(updatedNames) ||
    JSON.stringify(existingData.current_data) !== JSON.stringify(updatedCurrentData);

  if (!dataHasChanged) {
    console.log("Keine Änderungen erkannt. Überspringe Schreiboperation.");
    return res.status(200).json({
      status: "success",
      message: "Keine Änderungen erkannt",
    });
  }

  console.log("Änderungen erkannt. Speichere aktualisierte Daten...");
  console.log("Schreibe URL:", writeUrl);

  try {
    // PATCH-Request zum Speichern der aktualisierten Daten
    const response = await fetch(writeUrl, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ user_data: updatedData }),
    });

    const result = await response.json();
    console.log("Daten erfolgreich aktualisiert:", result);

    return res.status(200).json({
      status: "success",
      message: "Daten erfolgreich aktualisiert",
      data: result,
    });
  } catch (error) {
    console.error("Fehler beim Aktualisieren der Daten:", error);
    return res.status(500).json({
      status: "error",
      message: "Fehler beim Aktualisieren der Daten",
    });
  }
}
