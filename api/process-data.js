export default async function handler(req, res) {
  // Überprüfe den Authorization-Header
  const authHeader = req.headers.authorization;
  const expectedToken = process.env.AUTH_TOKEN; // Das Token aus den Vercel-Umgebungsvariablen

  if (!authHeader || authHeader !== `Bearer ${expectedToken}`) {
    return res.status(401).json({
      status: 'error',
      message: 'Unauthorized: Invalid or missing Authorization header',
    });
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: 'Only POST requests are allowed' });
  }

  const { storeurl, documentKey, first_name, last_name, email, phone, timestamp } = req.body;

  // Pflichtfelder prüfen
  if (!storeurl || !documentKey) {
    return res.status(400).json({
      status: 'error',
      message: 'storeurl and documentKey are required',
    });
  }

  const writeUrl = `${storeurl}/${documentKey}`;
  const readUrl = `${storeurl}/${documentKey}`;
  const currentTimestamp = timestamp || Date.now();

  console.log('Start processing:');
  console.log('Read URL:', readUrl);
  console.log('Write URL:', writeUrl);

  // Authorization-Header für Stape Store
  const authorizationHeader = `Bearer <YOUR_TOKEN>`; // Ersetze <YOUR_TOKEN> mit deinem Stape Store Token

  // Funktion: Daten aus dem Stape Store holen
  async function getExistingProfile() {
    try {
      const response = await fetch(readUrl, {
        method: 'GET',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': authorizationHeader
        },
      });

      console.log('GET Response:', response.status);

      if (response.status === 404) {
        console.log('Profile not found. Returning default structure.');
        return { user_data: { emails: [], names: [], phones: [] } }; // Initiale Struktur zurückgeben
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch profile. Status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Fetched Data:', data);

      return data?.data?.user_data || { emails: [], names: [], phones: [] };
    } catch (error) {
      console.error('Error fetching existing profile:', error.message);
      throw new Error(`Error fetching existing profile: ${error.message}`);
    }
  }

  // Funktion: Daten aktualisieren oder hinzufügen
  function updateProfile(existingProfile) {
    const updatedProfile = { ...existingProfile };

    // Initialisiere Arrays, falls sie nicht existieren
    if (!updatedProfile.emails) updatedProfile.emails = [];
    if (!updatedProfile.names) updatedProfile.names = [];
    if (!updatedProfile.phones) updatedProfile.phones = [];

    // E-Mail prüfen und ggf. hinzufügen
    if (email) {
      const emailExists = updatedProfile.emails.some((e) => e.email === email);
      if (!emailExists) {
        console.log('Adding new email:', email);
        updatedProfile.emails.push({ email, timestamp: currentTimestamp });
      }
    }

    // Telefonnummer prüfen und ggf. hinzufügen
    if (phone) {
      const phoneExists = updatedProfile.phones.some((p) => p.phone === phone);
      if (!phoneExists) {
        console.log('Adding new phone:', phone);
        updatedProfile.phones.push({ phone, timestamp: currentTimestamp });
      }
    }

    // Namen prüfen und ggf. hinzufügen
    if (first_name && last_name) {
      const nameExists = updatedProfile.names.some(
        (n) => n.first_name === first_name && n.last_name === last_name
      );
      if (!nameExists) {
        console.log('Adding new name:', `${first_name} ${last_name}`);
        updatedProfile.names.push({ first_name, last_name, timestamp: currentTimestamp });
      }
    }

    return updatedProfile;
  }

  // Funktion: Daten im Stape Store speichern
  async function writeProfile(updatedProfile) {
    try {
      const response = await fetch(writeUrl, {
        method: 'PATCH',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': authorizationHeader
        },
        body: JSON.stringify({ user_data: updatedProfile }),
      });

      console.log('PATCH Response:', response.status);

      if (!response.ok) {
        throw new Error(`Failed to write profile. Status: ${response.status}`);
      }
    } catch (error) {
      console.error('Error writing profile:', error.message);
      throw new Error(`Error writing profile: ${error.message}`);
    }
  }

  // Hauptprozess
  try {
    const existingProfile = await getExistingProfile();
    console.log('Existing Profile:', existingProfile);

    const updatedProfile = updateProfile(existingProfile);
    console.log('Updated Profile:', updatedProfile);

    await writeProfile(updatedProfile);

    return res.status(200).json({
      status: 'success',
      message: 'Profile updated successfully',
      data: updatedProfile,
    });
  } catch (error) {
    console.error('Processing Error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: `Failed to process data: ${error.message}`,
    });
  }
}
