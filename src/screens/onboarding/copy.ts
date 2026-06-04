// All onboarding wizard strings in one place.
// Plain, warm language tuned for a 35+ audience. No em dashes.

export const COPY = {
  name: {
    heading: 'What should we call you?',
    helper: "We'll use it to keep things personal.",
    placeholder: 'Your name',
  },
  body: {
    heading: 'Tell us a bit about your body.',
    helper: 'This helps us size your daily target. Nothing is shared.',
    weightLabel: 'Weight',
    weightUnit: 'kg',
    weightPlaceholder: 'e.g. 70',
    weightError: 'Please enter a weight between 30 and 200 kg.',
    ageLabel: 'Age',
    agePlaceholder: 'e.g. 40',
    ageError: 'Please enter an age between 12 and 100.',
    genderLabel: 'Gender',
  },
  activity: {
    heading: 'How active are you most days?',
    helper: 'Pick what feels typical. You can change this later.',
    options: [
      { value: 'sedentary', title: 'Mostly sitting', description: 'Desk work, little exercise' },
      { value: 'moderate', title: 'Moderately active', description: 'Some exercise most days' },
      { value: 'active', title: 'Very active', description: 'Hard exercise daily' },
    ] as const,
  },
  schedule: {
    heading: 'When does your day start and end?',
    helper: 'So reminders land while you are awake.',
    wakeLabel: 'Wake up',
    sleepLabel: 'Sleep',
    timeError: 'Your wake-up time should be before your sleep time.',
  },
  reveal: {
    greeting: (name: string) => `You're all set, ${name}.`,
    unitLabel: 'glasses a day',
    secondary: (mlText: string) => `that's ${mlText}`,
    explanation: 'We tailored this to your weight, age, and how active you are.',
    anchor: 'One glass is 250 ml, roughly a regular drinking glass.',
    cta: 'Start drinking',
  },
  back: 'Back',
  continue: 'Continue',
} as const;
