export default async function handler(req, res) {
  const {
    storeurl,
    documentKey,
    first_name,
    last_name,
    email,
    phone,
    timestamp,
  } = req.body;

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

  // Function to fetch the existing profile from the database
  async function getExistingProfile() {
    try {
      const response = await fetch(readUrl, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (response.status === 404) {
        console.log('Profile not found. Initializing default structure.');
        return { emails: [], names: [], phones: [] };
      }

      if (!response.ok) {
        throw new Error(`Failed to fetch profile. Status: ${response.status}`);
      }

      const data = await response.json();
      console.log('Fetched Data from Database:', JSON.stringify(data, null, 2));

      // Adjust this line based on the actual structure of 'data'
      return data.user_data || { emails: [], names: [], phones: [] };
    } catch (error) {
      console.error('Error fetching existing profile:', error.message);
      throw new Error('Failed to fetch profile.');
    }
  }

  // Function to update the profile with new data
  function updateProfile(existingProfile = {}) {
    const updatedProfile = { ...existingProfile };

    // Ensure arrays are properly initialized
    updatedProfile.emails = Array.isArray(updatedProfile.emails)
      ? updatedProfile.emails
      : [];
    updatedProfile.names = Array.isArray(updatedProfile.names)
      ? updatedProfile.names
      : [];
    updatedProfile.phones = Array.isArray(updatedProfile.phones)
      ? updatedProfile.phones
      : [];

    // Add new email if it doesn't exist
    if (
      email &&
      !updatedProfile.emails.some((item) => item.email === email)
    ) {
      updatedProfile.emails.push({ email, timestamp: currentTimestamp });
      console.log('Added new email:', email);
    }

    // Add new phone if it doesn't exist
    if (
      phone &&
      !updatedProfile.phones.some((item) => item.phone === phone)
    ) {
      updatedProfile.phones.push({ phone, timestamp: currentTimestamp });
      console.log('Added new phone:', phone);
    }

    // Add new name if it doesn't exist
    if (
      first_name &&
      last_name &&
      !updatedProfile.names.some(
        (item) =>
          item.first_name === first_name && item.last_name === last_name
      )
    ) {
      updatedProfile.names.push({
        first_name,
        last_name,
        timestamp: currentTimestamp,
      });
      console.log('Added new name:', `${first_name} ${last_name}`);
    }

    return updatedProfile;
  }

  // Function to check if the profile has changed
  function isProfileChanged(existingProfile, updatedProfile) {
    const keysToCompare = ['emails', 'names', 'phones'];

    for (const key of keysToCompare) {
      const existingData = existingProfile[key] || [];
      const updatedData = updatedProfile[key] || [];

      if (updatedData.length !== existingData.length) {
        console.log(`Detected change in ${key} length.`);
        return true;
      }

      for (let i = 0; i < updatedData.length; i++) {
        const existingItem = existingData[i];
        const updatedItem = updatedData[i];

        // Compare the items
        if (JSON.stringify(existingItem) !== JSON.stringify(updatedItem)) {
          console.log(
            `Detected change in ${key} at index ${i}.`,
            'Existing item:',
            existingItem,
            'Updated item:',
            updatedItem
          );
          return true;
        }
      }
    }

    console.log('No changes detected in profile.');
    return false;
  }

  // Function to write the updated profile back to the database
  async function writeProfile(updatedProfile) {
    try {
      console.log('Sending PATCH request to update profile...');
      const response = await fetch(writeUrl, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_data: updatedProfile }),
      });

      console.log('PATCH Response Status:', response.status);

      if (!response.ok) {
        throw new Error(`Failed to write profile. Status: ${response.status}`);
      }

      console.log('Profile successfully updated.');
    } catch (error) {
      console.error('Error writing profile:', error.message);
      throw new Error('Failed to write profile.');
    }
  }

  // Main execution block
  try {
    const existingProfile = (await getExistingProfile()) || {
      emails: [],
      names: [],
      phones: [],
    };
    console.log(
      'Existing Profile from Database:',
      JSON.stringify(existingProfile, null, 2)
    );

    const updatedProfile = updateProfile(existingProfile);
    console.log('Updated Profile:', JSON.stringify(updatedProfile, null, 2));

    // Compare existing and updated profiles
    const changesExist = isProfileChanged(existingProfile, updatedProfile);

    if (changesExist) {
      console.log('Changes detected. Writing profile...');
      await writeProfile(updatedProfile);
      return res.status(200).json({
        status: 'success',
        message: 'Profile updated successfully',
        data: updatedProfile,
      });
    } else {
      console.log('No changes detected. Skipping write operation.');
      return res.status(200).json({
        status: 'success',
        message: 'No changes detected',
        data: existingProfile,
      });
    }
  } catch (error) {
    console.error('Processing Error:', error.message);
    return res.status(500).json({
      status: 'error',
      message: error.message,
    });
  }
}
