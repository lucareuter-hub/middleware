import fetch from 'node-fetch';

export default async function handler(req, res) {
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

  // Funktion: Daten aus dem Stape Store holen
  async function getExistingProfile() {
    try {
      const response = await fetch(readUrl, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.status === 404) {
        return { user_data: { emails: [], names: [], phones: [] } }; // Initiale Struktur zurückgeben
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch profile. Status: ${response.status}`);
      }

      const data = await response.json();
      return data?.data?.user_data || { emails: [], names: [], phones: [] };
    } catch (error) {
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
        updatedProfile.emails.push({ email, timestamp: currentTimestamp });
      }
    }

    // Telefonnummer prüfen und ggf. hinzufügen
    if (phone) {
      const phoneExists = updatedProfile.phones.some((p) => p.phone === phone);
      if (!phoneExists) {
        updatedProfile.phones.push({ phone, timestamp: currentTimestamp });
      }
    }

    // Namen prüfen und ggf. hinzufügen
    if (first_name && last_name) {
      const nameExists = updatedProfile.names.some(
        (n) => n.first_name === first_name && n.last_name === last_name
      );
      if (!nameExists) {
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_data: updatedProfile }),
      });

      if (!response.ok) {
        throw new Error(`Failed to write profile. Status: ${response.status}`);
      }
    } catch (error) {
      throw new Error(`Error writing profile: ${error.message}`);
    }
  }

  // Hauptprozess
  try {
    const existingProfile = await getExistingProfile();
    const updatedProfile = updateProfile(existingProfile);
    await writeProfile(updatedProfile);

    return res.status(200).json({
      status: 'success',
      message: 'Profile updated successfully',
      data: updatedProfile,
    });
  } catch (error) {
    return res.status(500).json({
      status: 'error',
      message: `Failed to process data: ${error.message}`,
    });
  }
}
