export function requireLogin(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Please log in first." });
  }
  next();
}

export function requireSitter(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Please log in first." });
  }
  if (req.session.role !== "sitter") {
    return res.status(403).json({ message: "Sitters only." });
  }
  next();
}

export function requireOwner(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ message: "Please log in first." });
  }
  if (req.session.role !== "owner") {
    return res.status(403).json({ message: "Owners only." });
  }
  next();
}
