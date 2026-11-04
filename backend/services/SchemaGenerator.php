<?php
/**
 * ============================================================================
 * HARICHAND STEEL — GOOGLE-COMPLIANT STRUCTURED DATA (JSON-LD) GENERATOR
 * Target PHP: Core PHP 8.x
 * Compliant with Google Search Central Guidelines
 * ============================================================================
 */

declare(strict_types=1);

namespace Harichand\Services;

class SchemaGenerator {
    private const BASE_URL = 'https://harichandsteel.com';

    /**
     * Generate Google-Compliant JSON-LD Product Schema
     *
     * @param array $product Product data dictionary
     * @param string|null $domain Domain override
     * @return array|null
     */
    public static function generateProductSchema(array $product, ?string $domain = null): ?array {
        if (isset($product['schemaEnabled']) && $product['schemaEnabled'] === false) {
            return null;
        }

        $base = rtrim($domain ?: self::BASE_URL, '/');
        $rawSlug = $product['slug'] ?? 'product-' . time();
        $cleanSlug = trim($rawSlug, '/');
        $canonicalUrl = "{$base}/product/{$cleanSlug}/";

        // 1. Process Absolute Image URL
        $imgPath = $product['image'] ?? 'images/prod-1.png';
        if (str_starts_with($imgPath, 'http://') || str_starts_with($imgPath, 'https://')) {
            $imageUrl = $imgPath;
        } elseif (str_starts_with($imgPath, 'data:')) {
            $imageUrl = "{$base}/images/prod-1.png"; // Disallow data URI for search engines
        } else {
            $imageUrl = "{$base}/" . ltrim($imgPath, '/');
        }

        // 2. Numeric Price Extraction
        $priceRaw = $product['schemaPrice'] ?? $product['price'] ?? '25000';
        $priceClean = preg_replace('/[^0-9.]/', '', (string)$priceRaw);
        $numericPrice = is_numeric($priceClean) && (float)$priceClean > 0 ? (float)$priceClean : 25000.00;

        $title = $product['title'] ?? $product['name'] ?? 'Architectural Gate';
        $desc = $product['description'] ?? "High-durability architectural gate manufactured by Harichand Steel in Delhi NCR.";

        $schema = [
            '@context'    => 'https://schema.org',
            '@type'       => 'Product',
            '@id'         => "{$canonicalUrl}#product",
            'name'        => $title,
            'image'       => [$imageUrl],
            'description' => $desc,
            'url'         => $canonicalUrl,
            'brand'       => [
                '@type' => 'Brand',
                'name'  => $product['schemaBrand'] ?? 'Harichand Steel'
            ]
        ];

        // Optional Identifiers
        if (!empty($product['schemaSku'])) $schema['sku'] = (string)$product['schemaSku'];
        if (!empty($product['schemaMpn'])) $schema['mpn'] = (string)$product['schemaMpn'];
        if (!empty($product['schemaGtin'])) $schema['gtin'] = (string)$product['schemaGtin'];

        // Offers Block
        if (!isset($product['schemaOfferEnabled']) || $product['schemaOfferEnabled'] !== false) {
            $schema['offers'] = [
                '@type'           => 'Offer',
                'price'           => number_format($numericPrice, 2, '.', ''),
                'priceCurrency'   => $product['schemaCurrency'] ?? 'INR',
                'availability'    => $product['schemaAvailability'] ?? 'https://schema.org/InStock',
                'itemCondition'   => $product['schemaCondition'] ?? 'https://schema.org/NewCondition',
                'priceValidUntil' => $product['schemaPriceValidUntil'] ?? '2026-12-31',
                'url'             => $canonicalUrl,
                'seller'          => [
                    '@type' => 'Organization',
                    'name'  => 'Harichand Steel',
                    'url'   => self::BASE_URL
                ]
            ];
        }

        // AggregateRating Block
        if (!empty($product['schemaReviewEnabled']) && !empty($product['schemaRatingValue'])) {
            $rating = (float)$product['schemaRatingValue'];
            $reviewCount = !empty($product['schemaReviewCount']) ? (int)$product['schemaReviewCount'] : 1;
            if ($rating >= 1.0 && $rating <= 5.0) {
                $schema['aggregateRating'] = [
                    '@type'       => 'AggregateRating',
                    'ratingValue' => number_format($rating, 1, '.', ''),
                    'reviewCount' => max(1, $reviewCount),
                    'bestRating'  => '5',
                    'worstRating' => '1'
                ];
            }
        }

        return $schema;
    }

    /**
     * Generate BreadcrumbList Schema
     */
    public static function generateBreadcrumbSchema(array $items): array {
        $elements = [];
        $pos = 1;
        foreach ($items as $name => $url) {
            $elements[] = [
                '@type'    => 'ListItem',
                'position' => $pos++,
                'name'     => $name,
                'item'     => $url
            ];
        }

        return [
            '@context'        => 'https://schema.org',
            '@type'           => 'BreadcrumbList',
            'itemListElement' => $elements
        ];
    }

    /**
     * Generate Organization Schema
     */
    public static function generateOrganizationSchema(): array {
        return [
            '@context'    => 'https://schema.org',
            '@type'       => 'Organization',
            '@id'         => self::BASE_URL . '/#organization',
            'name'        => 'Harichand Steel',
            'url'         => self::BASE_URL . '/',
            'telephone'   => '+91-9870433868',
            'email'       => 'Admin@HARICHANDSTEEL.COM',
            'address'     => [
                '@type'           => 'PostalAddress',
                'streetAddress'   => '27B, Street, New Jankipuri, Anup Nagar, Uttam Nagar, Bindapur',
                'addressLocality' => 'New Delhi',
                'addressRegion'   => 'Delhi',
                'postalCode'      => '110059',
                'addressCountry'  => 'IN'
            ]
        ];
    }
}

