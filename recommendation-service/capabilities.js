// Emergency capability model. required = hard filter. preferred = adds to readiness score.
// Scoring weights: time (travel+wait), load (1-occupancy), ready (preferred coverage). Each set sums to 1.
module.exports = {
  cardiac: { label: 'Cardiac',  required: ['er','icu','cath_lab'],          preferred: ['blood_bank','ventilator','ct_scan'],        weights: { time: 0.70, load: 0.15, ready: 0.15 } },
  stroke:  { label: 'Stroke',   required: ['er','ct_scan','stroke_unit'],   preferred: ['icu','ventilator','blood_bank'],            weights: { time: 0.70, load: 0.15, ready: 0.15 } },
  trauma:  { label: 'Trauma',   required: ['er','trauma_center','blood_bank','ot'], preferred: ['icu','ct_scan','ventilator'],       weights: { time: 0.60, load: 0.20, ready: 0.20 } },
  general: { label: 'General',  required: ['er'],                           preferred: ['icu','ct_scan','blood_bank'],               weights: { time: 0.50, load: 0.30, ready: 0.20 } }
};
