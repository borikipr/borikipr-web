export default function PropiedadSkeleton() {
  return (
    <div className="animate-pulse overflow-hidden rounded-[2rem] border border-[#e8e8e8] bg-white shadow-sm">
      {/* Imagen Skeleton */}
      <div className="h-64 w-full bg-gray-200" />
      
      <div className="p-8">
        {/* Eyebrow Skeleton */}
        <div className="h-4 w-24 rounded bg-gray-200" />
        
        {/* Title Skeleton */}
        <div className="mt-4 h-8 w-3/4 rounded bg-gray-200" />
        
        {/* Location Skeleton */}
        <div className="mt-3 h-4 w-1/2 rounded bg-gray-200" />
        
        {/* Price Skeleton */}
        <div className="mt-6 h-8 w-1/3 rounded bg-gray-200" />
        
        {/* Features Skeleton */}
        <div className="mt-8 flex gap-4 border-t border-[#efefef] pt-6">
          <div className="h-4 w-12 rounded bg-gray-200" />
          <div className="h-4 w-12 rounded bg-gray-200" />
          <div className="h-4 w-12 rounded bg-gray-200" />
        </div>
      </div>
    </div>
  );
}
