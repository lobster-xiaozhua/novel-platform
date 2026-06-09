export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 bg-primary-500 items-center justify-center">
        <div className="text-white text-center px-12">
          <h1 className="text-5xl font-bold mb-4">墨卷</h1>
          <p className="text-xl opacity-90">万千故事，皆在指尖</p>
        </div>
      </div>
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        {children}
      </div>
    </div>
  );
}
