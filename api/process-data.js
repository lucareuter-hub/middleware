export default async function handler(req, res) {
  // Prüfe die Methode der Anfrage
  if (req.method === 'POST') {
    // Lese die Daten aus der Anfrage
    const { name, message } = req.body;

    // Falls keine Daten gesendet wurden, sende einen Fehler zurück
    if (!name || !message) {
      return res.status(400).json({
        status: 'error',
        message: 'Bitte Name und Nachricht angeben.',
      });
    }

    // Antwort mit den empfangenen Daten
    return res.status(200).json({
      status: 'success',
      receivedData: { name, message },
    });
  }

  // Wenn keine POST-Anfrage, sende einen Fehler zurück
  res.status(405).json({
    status: 'error',
    message: 'Nur POST-Anfragen werden unterstützt.',
  });
}
