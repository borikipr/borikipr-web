import type { DictionaryShape } from "@/lib/i18n/get-dictionary";

const enUS = {
  language: {
    selectorLabel: "Select language",
    spanish: "Español",
    english: "English",
    spanishShort: "ES",
    englishShort: "EN",
  },
  navigation: {
    home: "Home",
    listings: "Listings",
    about: "About",
    testimonials: "Testimonials",
    contact: "Contact",
    privacy: "Privacy",
    consultation: "Consultation",
    scheduleConsultation: "Schedule consultation",
    openMenu: "Open menu",
    closeMenu: "Close menu",
    menu: "Navigation",
    homeAriaLabel: "Go to home",
  },
  common: {
    search: "Search",
    close: "Close",
    previous: "Previous",
    next: "Next",
    viewProperty: "View property",
    viewListings: "View all listings",
    contactIvonne: "Contact Ivonne",
    learnMore: "Meet Ivonne",
    continue: "Continue",
    back: "Back",
    save: "Save",
    cancel: "Cancel",
  },
  gallery: {
    open: "Open gallery",
    view: "View gallery",
    viewImage: "View image",
    viewVideo: "View video",
    close: "Close gallery",
    previous: "Previous",
    next: "Next",
    imageAlt: "image",
  },
  footer: {
    brandDescription:
      "Professional guidance to buy, sell, or invest in Puerto Rico with strategy, clarity, and confidence.",
    navigationHeading: "Navigation",
    servicesHeading: "Services",
    services: {
      buying: "Property purchases",
      selling: "Property sales",
      consulting: "Real estate consulting",
      strategy: "Strategic guidance",
    },
    contactHeading: "Contact",
    email: "Email",
    location: "Location",
    license: "License",
    professionalLine:
      "Ivonne Erickson · Real Estate Broker · License C-25961",
    copyright: "Erickson Real Estate. All rights reserved.",
  },
  home: {
    hero: {
      imageAlt: "Luxury residence in Puerto Rico",
      title: "Properties presented with strategy, intention, and presence.",
      locationPlaceholder: "Search by location",
      showFilters: "Show filters",
      hideFilters: "Close filters",
      zones: "Areas",
      municipalities: "Municipalities",
      sale: "For sale",
      rent: "For rent",
      priceRange: "Price range",
      minimum: "Min",
      maximum: "Max",
      bedrooms: "Bedrooms",
      bathrooms: "Bathrooms",
      all: "All",
      propertyType: "Property type",
      propertyTypes: [
        "Apartment",
        "Commercial",
        "Houses",
        "Land",
        "Multi-family",
      ],
      availableSingular: "listing available",
      availablePlural: "listings available",
      description:
        "Buy, sell, or invest with clear guidance, strategy, and confidence from the start.",
      exploreListings: "Explore listings",
      scheduleConsultation: "Schedule consultation",
    },
    reasons: {
      eyebrow: "Why Erickson Real Estate?",
      title: "Clear strategy. Precise execution. Intentional results.",
      description:
        "More than a real estate service, this is a guided experience built on strategy, transparency, and genuine support so you can make confident decisions at every stage.",
      items: [
        {
          title: "Personalized attention",
          description:
            "Every client receives a strategy tailored to their goals, lifestyle, and long-term vision.",
        },
        {
          title: "Market strategy",
          description:
            "Current market knowledge helps you make informed decisions and identify the best opportunities.",
        },
        {
          title: "Premium presentation",
          description:
            "Professional presentation and marketing strategies designed to highlight each property's potential.",
        },
        {
          title: "Complete support",
          description:
            "Close, consistent guidance from the first conversation through closing.",
        },
      ],
    },
    listings: {
      eyebrow: "New listings",
      title: "Discover the newest available listings.",
      description:
        "Explore properties recently added for sale and rent, with clear and current information to help you make decisions confidently.",
      comingSoon: "Coming soon",
      emptyTitle: "New listings will be available soon",
      emptyDescription:
        "This section is updated regularly with properties for sale and rent. Check back soon to discover the latest opportunities.",
      featured: "Featured",
      sale: "For sale",
      rent: "For rent",
      bedroomsShort: "bd",
      bathroomsShort: "ba",
      priceSoon: "Price coming soon",
      statuses: {
        available: "Available",
        comingSoon: "Coming soon",
        underContract: "Under contract",
        sold: "Sold",
        rented: "Rented",
      },
    },
    regions: {
      eyebrow: "Regions",
      title: "Serving communities across Puerto Rico.",
      description:
        "From the metropolitan area to the coasts and mountains, discover real estate opportunities throughout Puerto Rico.",
      descriptions: [
        "San Juan, Guaynabo, Carolina, Bayamón, and more.",
        "Dorado, Arecibo, Manatí, Vega Baja, and more.",
        "Ponce, Guayama, Salinas, Coamo, and more.",
        "Fajardo, Río Grande, Luquillo, Vieques, and more.",
        "Mayagüez, Cabo Rojo, Rincón, Isabela, and more.",
        "Cayey, Aibonito, Barranquitas, Orocovis, and more.",
      ],
    },
    testimonials: {
      eyebrow: "Testimonials",
      title: "Real experiences that speak for themselves.",
      description:
        "Stories from people who trusted us to buy, sell, or invest in Puerto Rico.",
      viewAll: "View all testimonials",
      buyer: "Purchase",
      seller: "Sale",
    },
    cta: {
      eyebrow: "Let's get started",
      title: "A good decision starts with a good conversation.",
      description:
        "Whether you are buying, selling, or investing, I am here to offer personalized, strategic guidance focused on your goals.",
      requestGuidance: "Request guidance",
      meetIvonne: "Meet Ivonne",
    },
  },
  about: {
    imageAlt: "Ivonne Erickson - Real Estate Broker in Puerto Rico",
    hero: {
      eyebrow: "About me",
      title: "Experience, strategy, and support in every decision.",
      paragraphs: [
        "I am Ivonne Erickson, a real estate broker in Puerto Rico, committed to guiding you with clarity, strategy, and personalized attention that inspires confidence at every stage of the process.",
        "Buying, selling, or investing in a property is not simply a transaction; it is an important decision that requires market knowledge, precise guidance, and solid professional advice.",
        "My commitment is to support you from beginning to end, providing a smooth, transparent experience focused on helping you achieve your goals.",
      ],
      schedule: "Schedule a consultation",
      whatsapp: "Message me on WhatsApp",
    },
    philosophy: {
      eyebrow: "Service philosophy",
      title: "Every property deserves a well-considered strategy",
      description:
        "My approach goes beyond a simple transaction. I work with each property intentionally, clearly, and strategically, creating an organized and professional real estate experience where every client feels supported, informed, and confident in every decision.",
      values: [
        {
          title: "Clarity",
          description:
            "Direct communication, transparent guidance, and every step explained precisely so you can make decisions with confidence.",
        },
        {
          title: "Strategy",
          description:
            "Every property is unique. I design a personalized approach based on real goals, market analysis, and smart decisions.",
        },
        {
          title: "Trust",
          description:
            "More than closing deals, I build relationships through professional presence, consistency, and support at every stage of the process.",
        },
      ],
    },
    presentation: {
      eyebrow: "Professional presence",
      title: "How a property is presented defines its value",
      description:
        "Every detail communicates. From the presentation of a property to the way a decision is guided, everything influences perception and results. My approach combines strategy, service, and a consistent professional image to elevate every experience.",
    },
    credentials: {
      eyebrow: "Credentials",
      role: "Real Estate Broker",
      location: "Puerto Rico",
      licenseLabel: "License",
      license: "C-25961",
      focusLabel: "Focus",
      focus: "Clear guidance for buying, selling, and investing in real estate.",
    },
    cta: {
      eyebrow: "Next step",
      title: "Making the right decision starts with a good conversation",
      description:
        "If you are considering buying, selling, or investing in Puerto Rico, I will guide you with clarity, strategy, and a professional experience from the very first moment.",
      schedule: "Schedule consultation",
      listings: "Explore properties",
    },
  },
  contactHub: {
    eyebrow: "Contact",
    title: "How can I guide you?",
    description:
      "Choose the option that best matches what you need so I can guide you with greater clarity, strategy, and an experience aligned with your goals in Puerto Rico.",
    options: [
      {
        eyebrow: "BUYERS AND TENANTS",
        title: "I want to buy or rent",
        description:
          "Register to join my active buyer and tenant network. This will allow me to offer more personalized guidance and share opportunities aligned with your needs.",
        label: "Register",
      },
      {
        eyebrow: "SELLERS AND LANDLORDS",
        title: "I want to sell or rent",
        description:
          "Share information about your property and receive guidance on the next steps to sell or rent it with a strategy tailored to your goals.",
        label: "Request guidance",
      },
      {
        eyebrow: "GENERAL INQUIRY",
        title: "I need general guidance",
        description:
          "If you have questions, need additional guidance, or prefer a more direct conversation, you can also message me on WhatsApp.",
        label: "Message me on WhatsApp",
      },
    ],
  },
  listingsPage: {
    eyebrow: "Listings",
    title: "Properties for sale and rent",
    description:
      "Explore properties by municipality, price range, and type to find options aligned with your goals.",
    sale: "For sale",
    rent: "For rent",
    searchByLocation: "Search by location",
    zones: "Regions",
    municipalities: "Municipalities",
    minimumPrice: "Min $",
    maximumPrice: "Max $",
    bedrooms: "Bedrooms",
    bathrooms: "Bathrooms",
    propertyType: "Property type",
    all: "All",
    propertyTypes: {
      Casa: "House",
      Apartamento: "Apartment",
      Condominio: "Condominium",
      Terreno: "Land",
      Comercial: "Commercial",
    },
    regionLabels: {
      metropolitana: "Metropolitan Area",
      norte: "North",
      sur: "South",
      este: "East",
      oeste: "West",
      central: "Central",
    },
    statuses: {
      disponible: "Available",
      coming_soon: "Coming soon",
      bajo_contrato: "Under contract",
      vendida: "Sold",
      rentada: "Rented",
    },
    sort: {
      priceAsc: "Price: low to high",
      priceDesc: "Price: high to low",
      municipalityAsc: "Municipality: A-Z",
      municipalityDesc: "Municipality: Z-A",
    },
    filters: {
      search: "Search",
      region: "Region",
      municipality: "Municipality",
      types: "Types",
      from: "From",
      to: "To",
      bedroomsShort: "bd",
      bathroomsShort: "ba",
      active: "Active filters",
      remove: "Remove filter",
    },
    resultsSingular: "result",
    resultsPlural: "results",
    shareSearch: "Share search",
    linkCopied: "Link copied",
    copyFailed: "Could not copy link",
    emptyTitle: "We couldn't find properties matching those filters",
    emptyDescription:
      "Adjust your search or contact us so we can help you find an option aligned with what you are looking for in Puerto Rico.",
    requestGuidance: "Request guidance",
    whatsapp: "Message me on WhatsApp",
    featured: "Featured",
    collaboration: "In collaboration",
    externalReference: "External referral",
    addFavorite: "Add to favorites",
    removeFavorite: "Remove from favorites",
    bedroomsCard: "Bedrooms",
    bathroomsCard: "Bathrooms",
  },
  propertyDetail: {
    backToListings: "Back to listings",
    priceSoon: "Price coming soon",
    month: "month",
    sale: "For sale",
    rent: "For rent",
    featured: "Featured",
    statuses: {
      disponible: "Available",
      coming_soon: "Coming soon",
      bajo_contrato: "Under contract",
      vendida: "Sold",
      rentada: "Rented",
    },
    underContractTitle: "Under contract",
    underContractDescription:
      "This property is currently under contract. We can still guide you through this opportunity and show you similar options that fit what you are looking for.",
    talkToIvonne: "Talk to Ivonne",
    collaborationTitle: "Property offered in collaboration",
    collaborationDescription:
      "This property is presented in collaboration with another real estate professional. Ivonne Erickson can assist with guidance, information coordination, and representation, subject to availability and agreement between the parties.",
    collaborationDescriptionWithProfessional:
      "This property is presented in collaboration with another real estate professional. {name} can assist with guidance, information coordination, and representation, subject to availability and agreement between the parties.",
    externalTitle: "Referral property",
    externalDescription:
      "This property may come from an external source or professional collaboration. Its information is subject to availability confirmation.",
    facts: {
      type: "Type",
      status: "Status",
      bedrooms: "Bedrooms",
      bathrooms: "Bathrooms",
      parking: "Parking spaces",
      squareMeters: "Square meters",
    },
    interestEyebrow: "Interested in this property?",
    interestDescription:
      "Request more information, coordinate a showing, or ask Ivonne your questions directly.",
    interestDescriptionWithProfessional:
      "Request more information, coordinate a showing, or ask {name} your questions directly.",
    listingProfessionalSection: "Listing representative",
    listingProfessionalBroker: "Real Estate Broker",
    listingProfessionalSalesperson: "Real Estate Salesperson",
    licenseLabel: "Lic.",
    professionalPhotoAlt: "Professional photo of {name}",
    contact: "Contact",
    contactAccessible: "Contact us about {property}",
    whatsappAccessible: "Message {name} on WhatsApp about {property}",
    quickResponse: "Quick response through WhatsApp.",
    priorityRegistration: "Join the priority registry",
    requestInformation: "Request information",
    whatsapp: "Message on WhatsApp",
    buyerProfile: "Complete buyer profile",
    openHouse: "Register for the Open House",
    personalAttentionTitle: "Personalized attention",
    personalAttentionDescription:
      "Receive clear guidance about this property and similar options in Puerto Rico.",
    descriptionEyebrow: "Description",
    descriptionTitle: "Property details",
    similarEyebrow: "Similar options",
    similarTitle: "Other properties you may like",
    similarDescription:
      "Explore alternatives with similar characteristics in Puerto Rico.",
    viewDetails: "View details",
    bedroomShort: "bd",
    bathroomShort: "ba",
    whatsappGreeting: "Hello, I am interested in this property:",
    priceLabel: "Price",
    linkLabel: "Link",
    whatsappCollaboration: "Type: Property offered in collaboration",
    whatsappExternal: "Type: Referral property",
  },
  testimonialsPage: {
    imageAltSuffix: "Testimonial",
    featuredTag: "Featured testimonial",
    defaultTag: "Real experience",
    buyer: "Buyer",
    seller: "Seller",
    buyerTitle: "Purchase completed",
    sellerTitle: "Sale completed",
    readLess: "Read less",
    readMore: "Read more",
    eyebrow: "Testimonials",
    title: "Real experiences. Results built on trust.",
    description:
      "Every real estate process has a story. These experiences reflect the support, strategy, and clarity Ivonne brings to each client.",
    filters: {
      all: "All",
      buyers: "Buyers",
      sellers: "Sellers",
    },
    emptyTitle: "More real experiences are coming soon",
    emptyDescription:
      "We are preparing more real stories from clients who trusted Erickson Real Estate in Puerto Rico.",
    cta: {
      eyebrow: "Would you like a similar experience?",
      title: "Let's talk about your next real estate decision in Puerto Rico",
      description:
        "Every client deserves clear guidance, a solid strategy, and professional support from the first conversation.",
      contact: "Contact Ivonne",
      listings: "View properties",
    },
  },
  privacyPage: {
    eyebrow: "Privacy",
    title: "How we use your information",
    introduction:
      "BorikíPR and Erickson Real Estate collect information you voluntarily share to respond to real estate inquiries, evaluate your interest in properties, and follow up on the purchase, sale, rental, Open House, or private showing process.",
    sections: [
      {
        title: "Information and documents",
        body:
          "Forms may request contact details, real estate preferences, qualification responses, and, when applicable, prequalification letters or proof of funds. Financial documents are stored privately and can only be accessed through authorized administrative controls.",
      },
      {
        title: "Communications and follow-up",
        body:
          "We use the information to respond, coordinate follow-up, confirm registrations, and send notices related to the property or request that originated the contact. We do not publish your documents or their private links.",
      },
      {
        title: "Analytics and browser data",
        body:
          "Public pages may use Google Analytics, Microsoft Clarity, and Vercel Analytics to understand usage, performance, and errors. Sensitive forms are marked to hide their content in recordings. The admin area and routes with private links are excluded from client-side analytics.",
      },
    ],
    retention: {
      title: "Retention and your requests",
      beforeEmail:
        "We retain information for the time reasonably necessary to provide the service, maintain continuity of the process, and meet applicable obligations. You may request access, correction, or deletion by writing to",
      afterEmail:
        "Some requests may require us to verify your identity.",
    },
    notice:
      "This page describes how the system currently operates for informational purposes and should be reviewed periodically with applicable business or legal counsel.",
  },
  notFound: {
    eyebrow: "Page not found",
    title: "We couldn't find this page.",
    description:
      "The address may have changed or the content may no longer be available.",
    homeAction: "Return home",
    listingsAction: "View listings",
  },
} satisfies DictionaryShape;

export default enUS;
