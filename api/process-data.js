export default async function handler(req, res) {
  // Prüfe, ob die Anfrage den Authorization-Header enthält
  const authHeader = req.headers.authorization;
  const expectedToken = process.env.AUTH_TOKEN; // Speichere deinen Token als Umgebungsvariable

  if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
    return res.status(401).json({
      status: 'error',
      message: 'Unauthorized: Ungültiger oder fehlender Authorization-Header',
    });
  }

  // Prüfe, ob die Methode POST ist
  if (req.method === 'POST') {
    const { name, message } = req.body;

    if (!name || !message) {
      return res.status(400).json({
        status: 'error',
        message: 'Name und Nachricht sind erforderlich!',
      });
    }

    return res.status(200).json({
      status: 'success',
      receivedData: { name, message },
    });
  }

  // Wenn die Methode nicht unterstützt wird
  return res.status(405).json({
    status: 'error',
    message: 'Nur POST-Anfragen sind erlaubt!',
  });
}
