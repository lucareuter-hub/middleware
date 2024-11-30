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
      console.log('Sending GET request to fetch existing profile...');
      const response = await fetch(readUrl, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authorizationHeader,
        },
      });

      console.log('GET Response Status:', response.status);

      if (response.status === 404) {
        console.log('Profile not found. Initializing default structure.');
        return { emails: [], names: [], phones: [] }; // Initialisiere leere Struktur
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch profile. Status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Fetched Data from Database:', JSON.stringify(data, null, 2));

      return data?.data?.user_data || { emails: [], names: [], phones: [] };
    } catch (error) {
      console.error('Error fetching existing profile:', error.message);
      throw new Error(`Error fetching existing profile: ${error.message}`);
    }
  }

  // Funktion: Daten aktualisieren oder hinzufügen
  function updateProfile(existingProfile) {
    const updatedProfile = existingProfile || { emails: [], names: [], phones: [] };

    if (!updatedProfile.emails) updatedProfile.emails = [];
    if (!updatedProfile.names) updatedProfile.names = [];
    if (!updatedProfile.phones) updatedProfile.phones = [];

    // Emails hinzufügen, falls sie fehlen
    if (email) {
      updatedProfile.emails.push({ email, timestamp: currentTimestamp });
    }

    // Phones hinzufügen, falls sie fehlen
    if (phone) {
      updatedProfile.phones.push({ phone, timestamp: currentTimestamp });
    }

    // Names hinzufügen, falls sie fehlen
    if (first_name && last_name) {
      updatedProfile.names.push({
        first_name,
        last_name,
        timestamp: currentTimestamp,
      });
    }

    return updatedProfile;
  }

  // Funktion: Vergleichen von Objekten
  function isProfileChanged(existingProfile, updatedProfile) {
    const standardizedExistingProfile = {
      emails: existingProfile.emails || [],
      names: existingProfile.names || [],
      phones: existingProfile.phones || [],
    };

    console.log('Standardized Existing Profile:', JSON.stringify(standardizedExistingProfile));
    console.log('Updated Profile:', JSON.stringify(updatedProfile));

    // Check: Emails
    if (standardizedExistingProfile.emails.length !== updatedProfile.emails.length) {
      console.log('Email length mismatch detected.');
      return true;
    }

    // Check: Phones
    if (standardizedExistingProfile.phones.length !== updatedProfile.phones.length) {
      console.log('Phone length mismatch detected.');
      return true;
    }

    // Check: Names
    if (standardizedExistingProfile.names.length !== updatedProfile.names.length) {
      console.log('Name length mismatch detected.');
      return true;
    }

    console.log('No changes detected in profile.');
    return false;
  }

  // Funktion: Daten im Stape Store speichern
  async function writeProfile(updatedProfile) {
    try {
      console.log('Sending PATCH request to update profile...');
      const response = await fetch(writeUrl, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authorizationHeader,
        },
        body: JSON.stringify({ user_data: updatedProfile }),
      });

      console.log('PATCH Response Status:', response.status);

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
    console.log('Existing Profile from Database:', JSON.stringify(existingProfile, null, 2));

    const updatedProfile = updateProfile(existingProfile);
    console.log('Updated Profile to Write:', JSON.stringify(updatedProfile, null, 2));

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
