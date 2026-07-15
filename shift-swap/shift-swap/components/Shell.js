import Providers from "./Providers";
import Nav from "./Nav";

export default function Shell({ children }) {
  return (
    <Providers>
      <Nav />
      <main className="container">{children}</main>
    </Providers>
  );
}
