import { RegisterOptions } from 'react-hook-form';

const ValidationRules = {
  textRequired: {
    required: {
      value: true,
      message: 'This field is required',
    },
    minLength: {
      value: 3,
      message: 'Minimum length should be 3',
    },
    maxLength: {
      value: 250,
      message: 'Maximum length should be 250',
    },
  },
  textNotRequired: {
    minLength: {
      value: 3,
      message: 'Minimum length should be 3',
    },
    maxLength: {
      value: 250,
      message: 'Maximum length should be 250',
    },
  },
  urlRequired: {
    required: {
      value: true,
      message: 'This field is required',
    },
    pattern: {
      value:
        /^https?:\/\/(?:www\.)?[\w#%+.:=@~-]{1,256}\.[\d()A-Za-z]{1,6}\b[\w#%&()+./:=?@~-]*$/,
      message: 'Please enter a valid url',
    },
  },
};

export default ValidationRules;
