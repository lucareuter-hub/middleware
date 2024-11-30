export default async function handler(req, res) {
  const authHeader = req.headers.authorization;
  const expectedToken = process.env.AUTH_TOKEN;

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

  if (!storeurl || !documentKey) {
    return res.status(400).json({
      status: 'error',
      message: 'storeurl and documentKey are required',
    });
  }

  const writeUrl = `${storeurl}/${documentKey}`;
  const readUrl = `${storeurl}/${documentKey}`;
  const currentTimestamp = timestamp || Date.now();

  console.log('Start processing...');
  console.log('Read URL:', readUrl);
  console.log('Write URL:', writeUrl);

  const authorizationHeader = `Bearer <YOUR_TOKEN>`; // Set your Stape Store Authorization Token

  // Funktion: Daten aus dem Stape Store holen
  async function getExistingProfile() {
    try {
      const response = await fetch(readUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authorizationHeader,
        },
      });

      if (response.status === 404) {
        console.log('Profile not found. Initializing default structure.');
        return { user_data: { emails: [], names: [], phones: [] } }; // Initialisiere leere Struktur
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch profile. Status: ${response.status}`);
      }

      const data = await response.json();
      return data?.data?.user_data || { emails: [], names: [], phones: [] };
    } catch (error) {
      console.error('Error fetching existing profile:', error.message);
      throw new Error(`Error fetching existing profile: ${error.message}`);
    }
  }

  // Funktion: Array deduplizieren
  function deduplicateArray(array, key) {
    return array.filter(
      (item, index, self) =>
        index === self.findIndex((other) => other[key] === item[key])
    );
  }

  // Funktion: Daten aktualisieren oder hinzufügen
  function updateProfile(existingProfile) {
    // `user_data` sicherstellen
    const updatedProfile = existingProfile || { user_data: { emails: [], names: [], phones: [] } };

    if (!updatedProfile.emails) updatedProfile.emails = [];
    if (!updatedProfile.names) updatedProfile.names = [];
    if (!updatedProfile.phones) updatedProfile.phones = [];

    // Emails hinzufügen, falls sie fehlen
    if (email) {
      updatedProfile.emails.push({ email, timestamp: currentTimestamp });
      updatedProfile.emails = deduplicateArray(updatedProfile.emails, 'email');
    }

    // Phones hinzufügen, falls sie fehlen
    if (phone) {
      updatedProfile.phones.push({ phone, timestamp: currentTimestamp });
      updatedProfile.phones = deduplicateArray(updatedProfile.phones, 'phone');
    }

    // Names hinzufügen, falls sie fehlen
    if (first_name && last_name) {
      updatedProfile.names.push({
        first_name,
        last_name,
        timestamp: currentTimestamp,
      });
      updatedProfile.names = deduplicateArray(updatedProfile.names, 'first_name');
    }

    return updatedProfile;
  }

  // Funktion: Vergleichen von Objekten
  function isProfileChanged(existingProfile, updatedProfile) {
    return JSON.stringify(existingProfile) !== JSON.stringify(updatedProfile);
  }

  // Funktion: Daten im Stape Store speichern
  async function writeProfile(updatedProfile) {
    try {
      const response = await fetch(writeUrl, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authorizationHeader,
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
    const updatedProfile = updateProfile(existingProfile);

    console.log('Existing Profile:', JSON.stringify(existingProfile, null, 2));
    console.log('Updated Profile:', JSON.stringify(updatedProfile, null, 2));

    // Nur schreiben, wenn sich etwas geändert hat
    if (isProfileChanged(existingProfile, updatedProfile)) {
      console.log('Profile has changed. Writing to Stape Store...');
      await writeProfile(updatedProfile);
    } else {
      console.log('No changes detected. Skipping write operation.');
    }

    return res.status(200).json({
      status: 'success',
      message: 'Profile processed successfully',
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
