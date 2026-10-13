export const sampleTasklists = [
  // ==========================================
  // BOOKING 1 — Dog, 3-day stay
  // ==========================================
  {
    bookingId: 'b1',
    items: [
      {
        category: 'feed',
        title: 'Breakfast',
        petId:  ['p1'],
        dailyFrequency: 2,
        times: ['08:00', '18:00'],
        days: [],
        requiresPhoto: true,
        instructions: 'Give the dog its usual food in the kitchen.',
        referencePhotos: [],
        food: 'Dry kibble',
        amount: 1,
        unit: 'cup'
      },
      {
        category: 'walk',
        title: 'Morning and evening walks',
        petId:  ['p1'],
        dailyFrequency: 2,
        // No times: sitter chooses when to walk the dog.
        days: [],
        requiresPhoto: true,
        instructions: 'Use the blue leash. Avoid the busy main road.',
        referencePhotos: [],
        distanceKm: 2,
        durationMinutes: 30
      },
      {
        category: 'medication',
        title: 'Daily medication',
        petIds:  ['p1'],
        dailyFrequency: 1,
        times: ['12:00'],
        days: [],
        requiresPhoto: false,
        instructions: 'Administer the medication according to the dosage.',
        medicationName: 'Example medication',
        dosage: '1 tablet',
        withFood: true
      },
      {
        category: 'groom',
        title: 'Trim nails',
        petIds:  ['p1'],
        dailyFrequency: 1,
        // One occurrence on the specified booking day.
        days: [new Date('2026-11-03T00:00:00.000Z')],
        requiresPhoto: true,
        instructions: 'Trim only the tips. Stop if the dog becomes distressed.',
        referencePhotos: [],
        service: 'nail-trim'
      }
    ]
  },

  // ==========================================
  // BOOKING 2 — Cat, 5-day stay
  // ==========================================
  {
    bookingId: 'b2',
    items: [
      {
        category: 'feed',
        title: 'Wet food',
        petIds:  ['p2'],
        dailyFrequency: 2,
        times: ['07:30', '19:00'],
        days: [],
        requiresPhoto: true,
        instructions: 'Serve half a can at each feeding.',
        referencePhotos: [],
        food: 'Wet cat food',
        amount: 0.5,
        unit: 'can'
      },
      {
        category: 'feed',
        title: 'Top up dry food',
        petIds:  ['p2'],
        dailyFrequency: 1,
        // Sitter decides when during the visit.
        days: [],
        requiresPhoto: false,
        instructions: 'Check the bowl and top it up if needed.',
        referencePhotos: [],
        food: 'Dry kibble',
        amount: 0.5,
        unit: 'cup'
      },
      {
        category: 'groom',
        title: 'Brush coat',
        petIds:  ['p2'],
        dailyFrequency: 1,
        days: [],
        requiresPhoto: false,
        instructions: 'Brush gently, especially around the back.',
        referencePhotos: [],
        service: 'brush'
      },
      {
        category: 'medication',
        title: 'Evening medication',
        petIds:  ['p2'],
        dailyFrequency: 1,
        times: ['20:00'],
        days: [],
        requiresPhoto: true,
        instructions: 'Give after the evening meal.',
        medicationName: 'Example supplement',
        dosage: '2 ml',
        withFood: true
      },
      {
        category: 'other',
        title: 'Clean litter tray',
        petIds:  ['p2'],
        dailyFrequency: 1,
        days: [],
        requiresPhoto: false,
        instructions: 'Scoop waste and dispose of it in the outside bin.',
        referencePhotos: []
      }
    ]
  },

  // ==========================================
  // BOOKING 3 — Two dogs, 4-day stay
  // ==========================================
  {
    bookingId: 'b3',
    items: [
      {
        category: 'feed',
        title: 'Morning feeding',
        petIds:  ['p1'],
        dailyFrequency: 1,
        times: ['08:00'],
        days: [],
        requiresPhoto: true,
        instructions: 'Feed both dogs separately to prevent food stealing.',
        referencePhotos: [],
        food: 'Adult dog kibble',
        amount: 2,
        unit: 'cup'
      },
      {
        category: 'walk',
        title: 'Afternoon walk',
        petIds:  ['p2'],
        dailyFrequency: 1,
        // No fixed time; sitter chooses when.
        days: [],
        requiresPhoto: true,
        instructions: 'Keep both dogs on leash. Avoid off-leash areas.',
        referencePhotos: [],
        distanceKm: 3,
        durationMinutes: 45
      },
      {
        category: 'walk',
        title: 'Short evening walk',
        petIds: ['p2'],
        dailyFrequency: 1,
        times: ['18:30'],
        days: [],
        requiresPhoto: false,
        instructions: 'A short toilet break around the neighbourhood.',
        referencePhotos: [],
        distanceKm: 0.5,
        durationMinutes: 10
      },
      {
        category: 'groom',
        title: 'Brush both dogs',
        petIds: ['p1', 'p2'],
        dailyFrequency: 1,
        days: [new Date('2026-11-10T00:00:00.000Z')],
        requiresPhoto: true,
        instructions: 'Brush each dog thoroughly and check for tangles.',
        referencePhotos: [],
        service: 'brush'
      },
      {
        category: 'other',
        title: 'Water bowl check',
        petIds: ['p1', 'p2'],
        dailyFrequency: 2,
        days: [],
        requiresPhoto: false,
        instructions: 'Refresh the water bowls and ensure both dogs have access to water.',
        referencePhotos: []
      }
    ]
  }
]

