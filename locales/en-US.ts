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
