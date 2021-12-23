
export const personalInformation = {
  firstName: 'John',
  lastName: 'Doe',
  email: 'john.doe@example.com',
  title: '', // optional
  gender: 'männlich', // options: männlich, weiblich, divers, unbestimmt
  birthDate: '16.09.1997',
  IDNumber: '', // optional,
  street: 'Main Street',
  streetNumber: '1',
  zip: '12345',
  city: 'Munich',
  additionalAddress: '',
  telefon: '+49 123 4567890',
  mobile: '',
  businnesNumber: '',
  fax: '',
  comment: '',
}
export type PersonalInformation = typeof personalInformation