export const HOJA_DE_OFERTA_PAGE_POINTS = Object.freeze({
  width: 612,
  height: 792,
});

export const HOJA_DE_OFERTA_BROKER_FINAL_FIELD_POINTS = Object.freeze({
  x: 329,
  y: 644,
  width: 204,
  height: 32,
});

export const HOJA_DE_OFERTA_BROKER_FINAL_FIELD = Object.freeze({
  x:
    HOJA_DE_OFERTA_BROKER_FINAL_FIELD_POINTS.x /
    HOJA_DE_OFERTA_PAGE_POINTS.width,
  y:
    HOJA_DE_OFERTA_BROKER_FINAL_FIELD_POINTS.y /
    HOJA_DE_OFERTA_PAGE_POINTS.height,
  width:
    HOJA_DE_OFERTA_BROKER_FINAL_FIELD_POINTS.width /
    HOJA_DE_OFERTA_PAGE_POINTS.width,
  height:
    HOJA_DE_OFERTA_BROKER_FINAL_FIELD_POINTS.height /
    HOJA_DE_OFERTA_PAGE_POINTS.height,
});

