export default async function handler(req, res) {
  // Authorization prüfen
  const authHeader = req.headers.authorization;
  const expectedToken = process.env.AUTH_TOKEN;

  if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
    return res.status(401).json({
      status: 'error',
      message: 'Unauthorized: Ungültiger oder fehlender Authorization-Header',
    });
  }

  // Nur POST-Anfragen erlauben
  if (req.method === 'POST') {
    // Die relevanten Variablen aus dem Request-Body extrahieren
    const { documentKey, first_name, last_name, email, phone, timestamp, storeurl } = req.body;

    // Prüfen, ob die Pflichtfelder vorhanden sind
    if (!documentKey || !storeurl) {
      return res.status(400).json({
        status: 'error',
        message: 'Fehlende Pflichtfelder: documentKey oder storeurl',
      });
    }

    // Falls kein Timestamp vorhanden, nutze den aktuellen Zeitstempel (Epoch-Format)
    const finalTimestamp = timestamp || Date.now();

    // Alle empfangenen Variablen (inkl. Default-Werte) in der Response zurückgeben
    return res.status(200).json({
      status: 'success',
      receivedData: {
        documentKey,
        first_name: first_name || null, // Optional
        last_name: last_name || null,  // Optional
        email: email || null,          // Optional
        phone: phone || null,          // Optional
        timestamp: finalTimestamp,     // Aktueller oder übergebener Timestamp
        storeurl,
      },
    });
  }

  // Fehler für andere HTTP-Methoden
  return res.status(405).json({
    status: 'error',
    message: 'Nur POST-Anfragen sind erlaubt!',
  });
}
