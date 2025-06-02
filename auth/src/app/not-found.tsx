// src/app/not-found.tsx
export const metadata = {
  title: '404',
};
export default function NotFound() {
  return (
    <div>
      <h1>404 - Page Not Found</h1>
      <p>You will be redirected to the Fork Page...</p>
      <script
        dangerouslySetInnerHTML={{
          __html: `setTimeout(() => { window.location.href = '/' }, 1000);`
        }}
      />
    </div>
  );
}
