// SIMULATED data. Coordinates are approximate; capabilities/occupancy are illustrative.
// Replace with a hospital-pushed feed (portal/HMS/ABDM) when available.
const hospitals = [
  { id: 'aiims',   name: 'AIIMS Delhi',            lat: 28.5672, lng: 77.2100, doctors: 10, occupancy: 0.92, capabilities: ['er','icu','ct_scan','cath_lab','stroke_unit','trauma_center','blood_bank','ot','ventilator'] },
  { id: 'sjh',     name: 'Safdarjung Hospital',    lat: 28.5685, lng: 77.2070, doctors: 9,  occupancy: 0.88, capabilities: ['er','icu','ct_scan','trauma_center','blood_bank','ot','ventilator'] },
  { id: 'rml',     name: 'RML Hospital',           lat: 28.6258, lng: 77.2000, doctors: 7,  occupancy: 0.70, capabilities: ['er','icu','ct_scan','cath_lab','blood_bank','ot','ventilator'] },
  { id: 'lnjp',    name: 'LNJP Hospital',          lat: 28.6385, lng: 77.2380, doctors: 8,  occupancy: 0.78, capabilities: ['er','icu','ct_scan','trauma_center','blood_bank','ot','ventilator'] },
  { id: 'maxsaket',name: 'Max Saket',              lat: 28.5275, lng: 77.2120, doctors: 6,  occupancy: 0.55, capabilities: ['er','icu','ct_scan','cath_lab','stroke_unit','blood_bank','ot','ventilator'] },
  { id: 'escorts', name: 'Fortis Escorts Okhla',   lat: 28.5610, lng: 77.2740, doctors: 5,  occupancy: 0.50, capabilities: ['er','icu','cath_lab','ct_scan','blood_bank','ot'] },
  { id: 'apollo',  name: 'Apollo Sarita Vihar',    lat: 28.5410, lng: 77.2870, doctors: 6,  occupancy: 0.60, capabilities: ['er','icu','ct_scan','stroke_unit','blood_bank','ot','ventilator'] },
  { id: 'medanta', name: 'Medanta, Gurugram',      lat: 28.4395, lng: 77.0425, doctors: 7,  occupancy: 0.65, capabilities: ['er','icu','ct_scan','cath_lab','stroke_unit','trauma_center','blood_bank','ot','ventilator'] },
  { id: 'cityhosp',name: 'City General (small)',   lat: 28.5500, lng: 77.2200, doctors: 3,  occupancy: 0.35, capabilities: ['er','icu','blood_bank'] }
];
const clinics = [
  { id: 'c1', name: 'Saket Urgent Care Clinic', lat: 28.5230, lng: 77.2050, capabilities: ['first_aid','oxygen','ecg'] },
  { id: 'c2', name: 'Okhla Community Clinic',   lat: 28.5560, lng: 77.2800, capabilities: ['first_aid','oxygen'] },
  { id: 'c3', name: 'Gurgaon Sector 38 Clinic', lat: 28.4450, lng: 77.0500, capabilities: ['first_aid','oxygen','ecg'] }
];
module.exports = { hospitals, clinics };
