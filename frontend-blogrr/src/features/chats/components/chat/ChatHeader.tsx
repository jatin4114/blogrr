export default function ChatHeader({ name }: { name: string }) {
    return (
      <div className="p-4 border-b border-gray-200 font-medium text-lg flex items-center">
        <div className="flex-1">{name}</div>
        <div className="flex gap-2">
          {/* Optional: Add action icons here */}
        </div>
      </div>
    );
  }