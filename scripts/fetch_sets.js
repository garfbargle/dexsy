// Script to fetch all Pokémon TCG sets and save them to a CSV file
const fs = require('fs');
const https = require('https');

// Function to fetch sets from the Pokémon TCG API
async function fetchSets() {
  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'api.pokemontcg.io',
      path: '/v2/sets',
      method: 'GET',
      headers: {
        'Accept': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const parsedData = JSON.parse(data);
          resolve(parsedData.data);
        } catch (error) {
          reject(new Error(`Failed to parse response: ${error.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(new Error(`Request failed: ${error.message}`));
    });

    req.end();
  });
}

// Function to convert sets to CSV format
function convertToCSV(sets) {
  // Add header row
  let csv = 'setid,setname\n';
  
  // Add data rows
  sets.forEach(set => {
    // Escape any commas in the set name
    const escapedSetName = set.name.includes(',') ? `"${set.name}"` : set.name;
    csv += `${set.id},${escapedSetName}\n`;
  });
  
  return csv;
}

// Main function to fetch sets and save to CSV
async function main() {
  try {
    console.log('Fetching sets from the Pokémon TCG API...');
    const sets = await fetchSets();
    
    console.log(`Found ${sets.length} sets.`);
    
    // Sort sets by release date (newest first)
    const sortedSets = sets.sort((a, b) => 
      new Date(b.releaseDate) - new Date(a.releaseDate)
    );
    
    // Convert to CSV
    const csv = convertToCSV(sortedSets);
    
    // Save to file
    const filename = 'pokemon_sets.csv';
    fs.writeFileSync(filename, csv);
    
    console.log(`Successfully saved ${sortedSets.length} sets to ${filename}`);
  } catch (error) {
    console.error('Error:', error.message);
  }
}

// Run the script
main(); 