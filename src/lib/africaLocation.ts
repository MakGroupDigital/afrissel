export type AfricanCountry = {
  code: string;
  name: string;
  dialCode: string;
  apiName: string;
  timeZones: string[];
  fallbackCities: string[];
};

export const DEFAULT_COUNTRY_CODE = 'CD';

export const AFRICAN_COUNTRIES: AfricanCountry[] = [
  { code: 'CD', name: 'RDC', dialCode: '+243', apiName: 'Democratic Republic of the Congo', timeZones: ['Africa/Kinshasa', 'Africa/Lubumbashi'], fallbackCities: ['Kinshasa', 'Lubumbashi', 'Goma', 'Kisangani', 'Mbuji-Mayi', 'Bukavu', 'Kolwezi', 'Likasi', 'Matadi', 'Kananga'] },
  { code: 'DZ', name: 'Algerie', dialCode: '+213', apiName: 'Algeria', timeZones: ['Africa/Algiers'], fallbackCities: ['Alger', 'Oran', 'Constantine', 'Annaba', 'Blida'] },
  { code: 'AO', name: 'Angola', dialCode: '+244', apiName: 'Angola', timeZones: ['Africa/Luanda'], fallbackCities: ['Luanda', 'Huambo', 'Lobito', 'Benguela', 'Lubango'] },
  { code: 'BJ', name: 'Benin', dialCode: '+229', apiName: 'Benin', timeZones: ['Africa/Porto-Novo'], fallbackCities: ['Cotonou', 'Porto-Novo', 'Parakou', 'Djougou', 'Bohicon'] },
  { code: 'BW', name: 'Botswana', dialCode: '+267', apiName: 'Botswana', timeZones: ['Africa/Gaborone'], fallbackCities: ['Gaborone', 'Francistown', 'Molepolole', 'Maun', 'Serowe'] },
  { code: 'BF', name: 'Burkina Faso', dialCode: '+226', apiName: 'Burkina Faso', timeZones: ['Africa/Ouagadougou'], fallbackCities: ['Ouagadougou', 'Bobo-Dioulasso', 'Koudougou', 'Banfora', 'Ouahigouya'] },
  { code: 'BI', name: 'Burundi', dialCode: '+257', apiName: 'Burundi', timeZones: ['Africa/Bujumbura'], fallbackCities: ['Bujumbura', 'Gitega', 'Ngozi', 'Rumonge', 'Muyinga'] },
  { code: 'CM', name: 'Cameroun', dialCode: '+237', apiName: 'Cameroon', timeZones: ['Africa/Douala'], fallbackCities: ['Douala', 'Yaounde', 'Garoua', 'Bamenda', 'Maroua'] },
  { code: 'CV', name: 'Cap-Vert', dialCode: '+238', apiName: 'Cape Verde', timeZones: ['Atlantic/Cape_Verde'], fallbackCities: ['Praia', 'Mindelo', 'Santa Maria', 'Assomada', 'Tarrafal'] },
  { code: 'CF', name: 'Centrafrique', dialCode: '+236', apiName: 'Central African Republic', timeZones: ['Africa/Bangui'], fallbackCities: ['Bangui', 'Bimbo', 'Berberati', 'Carnot', 'Bambari'] },
  { code: 'TD', name: 'Tchad', dialCode: '+235', apiName: 'Chad', timeZones: ['Africa/Ndjamena'], fallbackCities: ['N Djamena', 'Moundou', 'Sarh', 'Abeche', 'Kelo'] },
  { code: 'KM', name: 'Comores', dialCode: '+269', apiName: 'Comoros', timeZones: ['Indian/Comoro'], fallbackCities: ['Moroni', 'Mutsamudu', 'Fomboni', 'Domoni', 'Tsimbeo'] },
  { code: 'CG', name: 'Congo-Brazzaville', dialCode: '+242', apiName: 'Republic of the Congo', timeZones: ['Africa/Brazzaville'], fallbackCities: ['Brazzaville', 'Pointe-Noire', 'Dolisie', 'Nkayi', 'Owando'] },
  { code: 'CI', name: 'Cote d Ivoire', dialCode: '+225', apiName: "Cote D'Ivoire (Ivory Coast)", timeZones: ['Africa/Abidjan'], fallbackCities: ['Abidjan', 'Bouake', 'Daloa', 'Yamoussoukro', 'San-Pedro'] },
  { code: 'DJ', name: 'Djibouti', dialCode: '+253', apiName: 'Djibouti', timeZones: ['Africa/Djibouti'], fallbackCities: ['Djibouti', 'Ali Sabieh', 'Tadjourah', 'Obock', 'Dikhil'] },
  { code: 'EG', name: 'Egypte', dialCode: '+20', apiName: 'Egypt', timeZones: ['Africa/Cairo'], fallbackCities: ['Le Caire', 'Alexandrie', 'Gizeh', 'Suez', 'Louxor'] },
  { code: 'GQ', name: 'Guinee equatoriale', dialCode: '+240', apiName: 'Equatorial Guinea', timeZones: ['Africa/Malabo'], fallbackCities: ['Malabo', 'Bata', 'Ebebiyin', 'Aconibe', 'Anisoc'] },
  { code: 'ER', name: 'Erythree', dialCode: '+291', apiName: 'Eritrea', timeZones: ['Africa/Asmara'], fallbackCities: ['Asmara', 'Keren', 'Massawa', 'Assab', 'Mendefera'] },
  { code: 'SZ', name: 'Eswatini', dialCode: '+268', apiName: 'Eswatini', timeZones: ['Africa/Mbabane'], fallbackCities: ['Mbabane', 'Manzini', 'Lobamba', 'Siteki', 'Nhlangano'] },
  { code: 'ET', name: 'Ethiopie', dialCode: '+251', apiName: 'Ethiopia', timeZones: ['Africa/Addis_Ababa'], fallbackCities: ['Addis-Abeba', 'Dire Dawa', 'Mekelle', 'Gondar', 'Hawassa'] },
  { code: 'GA', name: 'Gabon', dialCode: '+241', apiName: 'Gabon', timeZones: ['Africa/Libreville'], fallbackCities: ['Libreville', 'Port-Gentil', 'Franceville', 'Oyem', 'Moanda'] },
  { code: 'GM', name: 'Gambie', dialCode: '+220', apiName: 'Gambia', timeZones: ['Africa/Banjul'], fallbackCities: ['Banjul', 'Serekunda', 'Brikama', 'Bakau', 'Farafenni'] },
  { code: 'GH', name: 'Ghana', dialCode: '+233', apiName: 'Ghana', timeZones: ['Africa/Accra'], fallbackCities: ['Accra', 'Kumasi', 'Tamale', 'Takoradi', 'Cape Coast'] },
  { code: 'GN', name: 'Guinee', dialCode: '+224', apiName: 'Guinea', timeZones: ['Africa/Conakry'], fallbackCities: ['Conakry', 'Nzerekore', 'Kankan', 'Kindia', 'Labe'] },
  { code: 'GW', name: 'Guinee-Bissau', dialCode: '+245', apiName: 'Guinea-Bissau', timeZones: ['Africa/Bissau'], fallbackCities: ['Bissau', 'Bafata', 'Gabu', 'Cacheu', 'Bolama'] },
  { code: 'KE', name: 'Kenya', dialCode: '+254', apiName: 'Kenya', timeZones: ['Africa/Nairobi'], fallbackCities: ['Nairobi', 'Mombasa', 'Kisumu', 'Nakuru', 'Eldoret'] },
  { code: 'LS', name: 'Lesotho', dialCode: '+266', apiName: 'Lesotho', timeZones: ['Africa/Maseru'], fallbackCities: ['Maseru', 'Teyateyaneng', 'Mafeteng', 'Hlotse', 'Mohales Hoek'] },
  { code: 'LR', name: 'Liberia', dialCode: '+231', apiName: 'Liberia', timeZones: ['Africa/Monrovia'], fallbackCities: ['Monrovia', 'Gbarnga', 'Buchanan', 'Kakata', 'Voinjama'] },
  { code: 'LY', name: 'Libye', dialCode: '+218', apiName: 'Libya', timeZones: ['Africa/Tripoli'], fallbackCities: ['Tripoli', 'Benghazi', 'Misrata', 'Zawiya', 'Bayda'] },
  { code: 'MG', name: 'Madagascar', dialCode: '+261', apiName: 'Madagascar', timeZones: ['Indian/Antananarivo'], fallbackCities: ['Antananarivo', 'Toamasina', 'Antsirabe', 'Fianarantsoa', 'Mahajanga'] },
  { code: 'MW', name: 'Malawi', dialCode: '+265', apiName: 'Malawi', timeZones: ['Africa/Blantyre'], fallbackCities: ['Lilongwe', 'Blantyre', 'Mzuzu', 'Zomba', 'Kasungu'] },
  { code: 'ML', name: 'Mali', dialCode: '+223', apiName: 'Mali', timeZones: ['Africa/Bamako'], fallbackCities: ['Bamako', 'Sikasso', 'Mopti', 'Kayes', 'Segou'] },
  { code: 'MR', name: 'Mauritanie', dialCode: '+222', apiName: 'Mauritania', timeZones: ['Africa/Nouakchott'], fallbackCities: ['Nouakchott', 'Nouadhibou', 'Kiffa', 'Kaedi', 'Zouerate'] },
  { code: 'MU', name: 'Maurice', dialCode: '+230', apiName: 'Mauritius', timeZones: ['Indian/Mauritius'], fallbackCities: ['Port-Louis', 'Beau Bassin-Rose Hill', 'Vacoas', 'Curepipe', 'Quatre Bornes'] },
  { code: 'MA', name: 'Maroc', dialCode: '+212', apiName: 'Morocco', timeZones: ['Africa/Casablanca'], fallbackCities: ['Casablanca', 'Rabat', 'Fes', 'Marrakech', 'Tanger'] },
  { code: 'MZ', name: 'Mozambique', dialCode: '+258', apiName: 'Mozambique', timeZones: ['Africa/Maputo'], fallbackCities: ['Maputo', 'Matola', 'Beira', 'Nampula', 'Chimoio'] },
  { code: 'NA', name: 'Namibie', dialCode: '+264', apiName: 'Namibia', timeZones: ['Africa/Windhoek'], fallbackCities: ['Windhoek', 'Walvis Bay', 'Swakopmund', 'Rundu', 'Oshakati'] },
  { code: 'NE', name: 'Niger', dialCode: '+227', apiName: 'Niger', timeZones: ['Africa/Niamey'], fallbackCities: ['Niamey', 'Zinder', 'Maradi', 'Agadez', 'Tahoua'] },
  { code: 'NG', name: 'Nigeria', dialCode: '+234', apiName: 'Nigeria', timeZones: ['Africa/Lagos'], fallbackCities: ['Lagos', 'Abuja', 'Kano', 'Ibadan', 'Port Harcourt'] },
  { code: 'RW', name: 'Rwanda', dialCode: '+250', apiName: 'Rwanda', timeZones: ['Africa/Kigali'], fallbackCities: ['Kigali', 'Butare', 'Gitarama', 'Ruhengeri', 'Gisenyi'] },
  { code: 'ST', name: 'Sao Tome-et-Principe', dialCode: '+239', apiName: 'Sao Tome and Principe', timeZones: ['Africa/Sao_Tome'], fallbackCities: ['Sao Tome', 'Santo Antonio', 'Neves', 'Trindade', 'Guadalupe'] },
  { code: 'SN', name: 'Senegal', dialCode: '+221', apiName: 'Senegal', timeZones: ['Africa/Dakar'], fallbackCities: ['Dakar', 'Touba', 'Thies', 'Saint-Louis', 'Kaolack'] },
  { code: 'SC', name: 'Seychelles', dialCode: '+248', apiName: 'Seychelles', timeZones: ['Indian/Mahe'], fallbackCities: ['Victoria', 'Anse Boileau', 'Beau Vallon', 'Cascade', 'Takamaka'] },
  { code: 'SL', name: 'Sierra Leone', dialCode: '+232', apiName: 'Sierra Leone', timeZones: ['Africa/Freetown'], fallbackCities: ['Freetown', 'Bo', 'Kenema', 'Makeni', 'Koidu'] },
  { code: 'SO', name: 'Somalie', dialCode: '+252', apiName: 'Somalia', timeZones: ['Africa/Mogadishu'], fallbackCities: ['Mogadiscio', 'Hargeisa', 'Bosaso', 'Kismayo', 'Merca'] },
  { code: 'ZA', name: 'Afrique du Sud', dialCode: '+27', apiName: 'South Africa', timeZones: ['Africa/Johannesburg'], fallbackCities: ['Johannesburg', 'Le Cap', 'Durban', 'Pretoria', 'Port Elizabeth'] },
  { code: 'SS', name: 'Soudan du Sud', dialCode: '+211', apiName: 'South Sudan', timeZones: ['Africa/Juba'], fallbackCities: ['Juba', 'Wau', 'Malakal', 'Yei', 'Aweil'] },
  { code: 'SD', name: 'Soudan', dialCode: '+249', apiName: 'Sudan', timeZones: ['Africa/Khartoum'], fallbackCities: ['Khartoum', 'Omdurman', 'Port Sudan', 'Kassala', 'El Obeid'] },
  { code: 'TZ', name: 'Tanzanie', dialCode: '+255', apiName: 'Tanzania', timeZones: ['Africa/Dar_es_Salaam'], fallbackCities: ['Dar es Salaam', 'Dodoma', 'Mwanza', 'Arusha', 'Mbeya'] },
  { code: 'TG', name: 'Togo', dialCode: '+228', apiName: 'Togo', timeZones: ['Africa/Lome'], fallbackCities: ['Lome', 'Sokode', 'Kara', 'Kpalime', 'Atakpame'] },
  { code: 'TN', name: 'Tunisie', dialCode: '+216', apiName: 'Tunisia', timeZones: ['Africa/Tunis'], fallbackCities: ['Tunis', 'Sfax', 'Sousse', 'Kairouan', 'Bizerte'] },
  { code: 'UG', name: 'Ouganda', dialCode: '+256', apiName: 'Uganda', timeZones: ['Africa/Kampala'], fallbackCities: ['Kampala', 'Gulu', 'Lira', 'Mbarara', 'Jinja'] },
  { code: 'ZM', name: 'Zambie', dialCode: '+260', apiName: 'Zambia', timeZones: ['Africa/Lusaka'], fallbackCities: ['Lusaka', 'Ndola', 'Kitwe', 'Kabwe', 'Livingstone'] },
  { code: 'ZW', name: 'Zimbabwe', dialCode: '+263', apiName: 'Zimbabwe', timeZones: ['Africa/Harare'], fallbackCities: ['Harare', 'Bulawayo', 'Chitungwiza', 'Mutare', 'Gweru'] }
];

export const AFRICAN_COUNTRIES_BY_PRIORITY = [
  ...AFRICAN_COUNTRIES.filter((country) => country.code === DEFAULT_COUNTRY_CODE),
  ...AFRICAN_COUNTRIES
    .filter((country) => country.code !== DEFAULT_COUNTRY_CODE)
    .sort((first, second) => first.name.localeCompare(second.name))
];

export const getCountryByCode = (code?: string) =>
  AFRICAN_COUNTRIES.find((country) => country.code === code);

export const getCountryByName = (name?: string) => {
  if (!name) return undefined;
  const normalizedName = name.toLowerCase();
  return AFRICAN_COUNTRIES.find((country) =>
    country.name.toLowerCase() === normalizedName ||
    country.apiName.toLowerCase() === normalizedName
  );
};

export const getDefaultCountry = () =>
  getCountryByCode(DEFAULT_COUNTRY_CODE) || AFRICAN_COUNTRIES[0];

export const getDeviceCountryCode = () => {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const timeZoneMatch = AFRICAN_COUNTRIES.find((country) => country.timeZones.includes(timeZone));
  if (timeZoneMatch) return timeZoneMatch.code;

  const languageCandidates = [
    navigator.language,
    ...(navigator.languages || [])
  ].filter(Boolean);

  for (const language of languageCandidates) {
    try {
      const region = new Intl.Locale(language).region;
      if (region && getCountryByCode(region)) return region;
    } catch {
      // Ignore malformed browser locales.
    }
  }

  return DEFAULT_COUNTRY_CODE;
};

export const getDeviceCityHint = () => {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const cityPart = timeZone?.split('/').pop();
  if (!cityPart || cityPart === 'GMT') return '';
  return cityPart.replace(/_/g, ' ');
};

export const normalizeLocalPhone = (value: string) =>
  value.replace(/[^\d]/g, '').replace(/^0+/, '');

export const buildInternationalPhone = (dialCode: string, localPhone: string) => {
  const normalizedPhone = normalizeLocalPhone(localPhone);
  return normalizedPhone ? `${dialCode}${normalizedPhone}` : '';
};

export const getLocalPhoneFromInternational = (phone: string, dialCode: string) => {
  if (!phone) return '';
  const trimmedPhone = phone.replace(/\s/g, '');
  return normalizeLocalPhone(trimmedPhone.startsWith(dialCode)
    ? trimmedPhone.slice(dialCode.length)
    : trimmedPhone);
};

const uniqueSortedCities = (cities: string[]) =>
  Array.from(new Set(cities.map((city) => city.trim()).filter(Boolean)))
    .sort((first, second) => first.localeCompare(second));

export const fetchCitiesForCountry = async (country: AfricanCountry) => {
  const response = await fetch('https://countriesnow.space/api/v0.1/countries/cities', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ country: country.apiName })
  });

  const payload = await response.json().catch(() => null) as {
    error?: boolean;
    data?: string[];
    msg?: string;
  } | null;

  if (!response.ok || payload?.error || !Array.isArray(payload?.data)) {
    throw new Error(payload?.msg || 'Villes indisponibles.');
  }

  return uniqueSortedCities(payload.data);
};
