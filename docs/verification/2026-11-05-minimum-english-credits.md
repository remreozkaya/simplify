# Minimum English credit verification — 2026-11-05

Coverage: 228 bundled mixed-language undergraduate plans across 43 program identities. Historical and current plans are included.

Rule: minimum = ceil(30% of published local graduation credits). Totals below come from each stored plan’s `Toplam Kredi` note; expected minima use exact decimal arithmetic. ECTS and the imported selection of English rows are not used.

For every plan, `tests/curriculum/allMixedLanguagePlansUi.test.tsx` checks the numeric result, the shared Curriculum minimum label, and the Graduation Calculator rendering in Turkish and English (456 plan/language cases). This is component rendering verification against the bundled catalog, not a live browser audit or a fresh import of every upstream plan.

Coverage is selected from undergraduate source metadata independently of the production program list: fully English offerings and the Turkish Music conservatory are excluded. Five omitted mixed-language identities were added: FZT_LS, MTT_LS, ROS_LS, DUI_LS, and GMI_LS. Separately registered ÇAP/minor plans retain their existing treatment.

Upward-rounding boundary tests include 150 → 45, 151 → 46, 151.5 → 46, 152 → 46, 160 → 48, and a missing-published-total fallback of 7 → 3. Existing Spanish, German, and Chinese elective counting is preserved.

| Program | Plan ID | Published credits | Minimum English credits | Plan |
|---|---:|---:|---:|---|
| BIO_LS | 1 | 150.00 | 45 | Moleküler Biyoloji ve Genetik Lisans Programı 2002-2003 / Güz Dönemi Öncesi |
| BIO_LS | 2 | 147.50 | 45 | Moleküler Biyoloji ve Genetik Lisans Programı 2002-2003 / Güz ile 2009-2010 / Güz Dönemleri Arası |
| BIO_LS | 3 | 149.00 | 45 | Moleküler Biyoloji ve Genetik Lisans Programı 2009-2010 / Güz Dönemi Sonrası |
| BLG_LS | 1143 | 153.00 | 46 | Bilgisayar Mühendisliği Lisans Programı 2000-2001 / Güz Dönemi Öncesi |
| BLG_LS | 1144 | 152.00 | 46 | Bilgisayar Mühendisliği Lisans Programı 2000-2001 / Güz ile 2006-2007 / Güz Dönemleri Arası |
| BLG_LS | 1145 | 153.00 | 46 | Bilgisayar Mühendisliği Lisans Programı 2006-2007 / Güz ile 2009-2010 / Güz Dönemleri Arası |
| BLG_LS | 1146 | 153.00 | 46 | Bilgisayar Mühendisliği Lisans Programı 2009-2010 / Güz ile 2010-2011 / Güz Dönemleri Arası |
| BLG_LS | 1147 | 153.00 | 46 | Bilgisayar Mühendisliği Lisans Programı 2010-2011 / Güz ile 2011-2012 / Güz Dönemleri Arası |
| BLG_LS | 1148 | 150.50 | 46 | Bilgisayar Mühendisliği Lisans Programı 2011-2012 / Güz ile 2017-2018 / Güz Dönemleri Arası |
| BLG_LS | 1149 | 147.00 | 45 | Bilgisayar Mühendisliği Lisans Programı 2017-2018 / Güz ile 2021-2022 / Güz Dönemleri Arası |
| BLG_LS | 1561 | 130.00 | 39 | Bilgisayar Mühendisliği Lisans Programı 2021-2022 / Güz Dönemi Sonrası |
| CEV_LS | 352 | 151.50 | 46 | Çevre Mühendisliği Lisans Programı 2001-2002 / Güz Dönemi Öncesi |
| CEV_LS | 353 | 152.50 | 46 | Çevre Mühendisliği Lisans Programı 2001-2002 / Güz ile 2005-2006 / Güz Dönemleri Arası |
| CEV_LS | 354 | 150.50 | 46 | Çevre Mühendisliği Lisans Programı 2005-2006 / Güz ile 2009-2010 / Güz Dönemleri Arası |
| CEV_LS | 355 | 152.00 | 46 | Çevre Mühendisliği Lisans Programı 2009-2010 / Güz ile 2011-2012 / Güz Dönemleri Arası |
| CEV_LS | 356 | 153.50 | 47 | Çevre Mühendisliği Lisans Programı 2011-2012 / Güz ile 2017-2018 / Güz Dönemleri Arası |
| CEV_LS | 357 | 153.50 | 47 | Çevre Mühendisliği Lisans Programı 2017-2018 / Güz ile 2021-2022 / Güz Dönemleri Arası |
| CEV_LS | 1469 | 132.00 | 40 | Çevre Mühendisliği Lisans Programı 2021-2022 / Güz Dönemi Sonrası |
| CHZ_LS | 542 | 151.00 | 46 | Cevher Hazırlama Mühendisliği Lisans Programı 2009-2010 / Güz Dönemi Öncesi |
| CHZ_LS | 543 | 151.00 | 46 | Cevher Hazırlama Mühendisliği Lisans Programı 2009-2010 / Güz ile 2013-2014 / Güz Dönemleri Arası |
| CHZ_LS | 544 | 152.00 | 46 | Cevher Hazırlama Mühendisliği Lisans Programı 2013-2014 / Güz ile 2017-2018 / Güz Dönemleri Arası |
| CHZ_LS | 545 | 147.00 | 45 | Cevher Hazırlama Mühendisliği Lisans Programı 2017-2018 / Güz ile 2021-2022 / Güz Dönemleri Arası |
| CHZ_LS | 1479 | 135.50 | 41 | Cevher Hazırlama Mühendisliği Lisans Programı 2021-2022 / Güz Dönemi Sonrası |
| DEN_LS | 743 | 152.50 | 46 | Gemi ve Deniz Teknolojisi Mühendisliği Lisans Programı 2001-2002 / Güz Dönemi Öncesi |
| DEN_LS | 744 | 153.50 | 47 | Gemi ve Deniz Teknolojisi Mühendisliği Lisans Programı 2001-2002 / Güz ile 2002-2003 / Güz Dönemleri Arası |
| DEN_LS | 745 | 151.50 | 46 | Gemi ve Deniz Teknolojisi Mühendisliği Lisans Programı 2002-2003 / Güz ile 2009-2010 / Güz Dönemleri Arası |
| DEN_LS | 746 | 153.00 | 46 | Gemi ve Deniz Teknolojisi Mühendisliği Lisans Programı 2009-2010 / Güz ile 2012-2013 / Güz Dönemleri Arası |
| DEN_LS | 747 | 154.50 | 47 | Gemi ve Deniz Teknolojisi Mühendisliği Lisans Programı 2012-2013 / Güz ile 2017-2018 / Güz Dönemleri Arası |
| DEN_LS | 748 | 156.50 | 47 | Gemi ve Deniz Teknolojisi Mühendisliği Lisans Programı 2017-2018 / Güz ile 2021-2022 / Güz Dönemleri Arası |
| DEN_LS | 1491 | 130.50 | 40 | Gemi ve Deniz Teknolojisi Mühendisliği Lisans Programı 2021-2022 / Güz ile 2026-2027 / Güz Dönemleri Arası |
| DEN_LS | 2685 | 131.50 | 40 | Gemi ve Deniz Teknolojisi Mühendisliği Lisans Programı 2026-2027 / Güz Dönemi Sonrası |
| DUI_LS | 993 | 156.00 | 47 | Deniz Ulaştırma İşletme Mühendisliği Lisans Programı 2004-2005 / Güz Dönemi Öncesi |
| DUI_LS | 994 | 157.00 | 48 | Deniz Ulaştırma İşletme Mühendisliği Lisans Programı 2004-2005 / Güz ile 2009-2010 / Güz Dönemleri Arası |
| DUI_LS | 995 | 158.50 | 48 | Deniz Ulaştırma İşletme Mühendisliği Lisans Programı 2009-2010 / Güz ile 2013-2014 / Güz Dönemleri Arası |
| DUI_LS | 996 | 147.50 | 45 | Deniz Ulaştırma İşletme Mühendisliği Lisans Programı 2013-2014 / Güz ile 2017-2018 / Güz Dönemleri Arası |
| DUI_LS | 997 | 153.00 | 46 | Deniz Ulaştırma İşletme Mühendisliği Lisans Programı 2017-2018 / Güz ile 2021-2022 / Güz Dönemleri Arası |
| DUI_LS | 1557 | 133.00 | 40 | Deniz Ulaştırma İşletme Mühendisliği Lisans Programı 2021-2022 / Güz Dönemi Sonrası |
| EHB_LS | 232 | 154.50 | 47 | Elektronik ve Haberleşme Mühendisliği Lisans Programı 2017-2018 / Güz Dönemi Öncesi |
| EHB_LS | 233 | 157.00 | 48 | Elektronik ve Haberleşme Mühendisliği Lisans Programı 2017-2018 / Güz ile 2021-2022 / Güz Dönemleri Arası |
| EHB_LS | 1452 | 128.00 | 39 | Elektronik ve Haberleşme Mühendisliği Lisans Programı 2021-2022 / Güz Dönemi Sonrası |
| ELE_LS | 252 | 150.00 | 45 | Elektronik Mühendisliği Lisans Programı 2006-2007 / Güz Dönemi Öncesi |
| ELE_LS | 253 | 149.00 | 45 | Elektronik Mühendisliği Lisans Programı 2006-2007 / Güz ile 2008-2009 / Güz Dönemleri Arası |
| ELE_LS | 254 | 151.00 | 46 | Elektronik Mühendisliği Lisans Programı 2008-2009 / Güz ile 2009-2010 / Güz Dönemleri Arası |
| ELE_LS | 255 | 152.50 | 46 | Elektronik Mühendisliği Lisans Programı 2009-2010 / Güz Dönemi Sonrası |
| ELK_LS | 271 | 153.00 | 46 | Elektrik Mühendisliği Lisans Programı 2004-2005 / Güz Dönemi Öncesi |
| ELK_LS | 272 | 151.00 | 46 | Elektrik Mühendisliği Lisans Programı 2004-2005 / Güz ile 2009-2010 / Güz Dönemleri Arası |
| ELK_LS | 273 | 152.50 | 46 | Elektrik Mühendisliği Lisans Programı 2009-2010 / Güz ile 2011-2012 / Güz Dönemleri Arası |
| ELK_LS | 274 | 155.00 | 47 | Elektrik Mühendisliği Lisans Programı 2011-2012 / Güz ile 2017-2018 / Güz Dönemleri Arası |
| ELK_LS | 275 | 157.50 | 48 | Elektrik Mühendisliği Lisans Programı 2017-2018 / Güz ile 2021-2022 / Güz Dönemleri Arası |
| ELK_LS | 1456 | 134.00 | 41 | Elektrik Mühendisliği Lisans Programı 2021-2022 / Güz Dönemi Sonrası |
| END_LS | 800 | 152.50 | 46 | Endüstri Mühendisliği Lisans Programı 2003-2004 / Güz Dönemi Öncesi |
| END_LS | 801 | 150.50 | 46 | Endüstri Mühendisliği Lisans Programı 2003-2004 / Güz ile 2008-2009 / Güz Dönemleri Arası |
| END_LS | 802 | 151.50 | 46 | Endüstri Mühendisliği Lisans Programı 2008-2009 / Güz ile 2009-2010 / Güz Dönemleri Arası |
| END_LS | 803 | 153.00 | 46 | Endüstri Mühendisliği Lisans Programı 2009-2010 / Güz ile 2017-2018 / Güz Dönemleri Arası |
| END_LS | 804 | 146.00 | 44 | Endüstri Mühendisliği Lisans Programı 2017-2018 / Güz ile 2021-2022 / Güz Dönemleri Arası |
| END_LS | 1510 | 128.00 | 39 | Endüstri Mühendisliği Lisans Programı 2021-2022 / Güz Dönemi Sonrası |
| EUT_LS | 120 | 150.00 | 45 | Endüstri Ürünleri Tasarımı Lisans Programı 2009-2010 / Güz Dönemi Öncesi |
| EUT_LS | 121 | 151.50 | 46 | Endüstri Ürünleri Tasarımı Lisans Programı 2009-2010 / Güz Dönemi Sonrası |
| FIZ_LS | 27 | 152.00 | 46 | Fizik Mühendisliği Lisans Programı 2004-2005 / Güz Dönemi Öncesi |
| FIZ_LS | 28 | 150.00 | 45 | Fizik Mühendisliği Lisans Programı 2004-2005 / Güz ile 2009-2010 / Güz Dönemleri Arası |
| FIZ_LS | 29 | 151.50 | 46 | Fizik Mühendisliği Lisans Programı 2009-2010 / Güz ile 2013-2014 / Güz Dönemleri Arası |
| FIZ_LS | 30 | 151.50 | 46 | Fizik Mühendisliği Lisans Programı 2013-2014 / Güz ile 2017-2018 / Güz Dönemleri Arası |
| FIZ_LS | 31 | 141.00 | 43 | Fizik Mühendisliği Lisans Programı 2017-2018 / Güz ile 2021-2022 / Güz Dönemleri Arası |
| FIZ_LS | 1438 | 122.00 | 37 | Fizik Mühendisliği Lisans Programı 2021-2022 / Güz Dönemi Sonrası |
| FZT_LS | 2611 | 121.00 | 37 | Fizik Lisans Programı 2026-2027 / Güz Dönemi Sonrası |
| GEM_LS | 757 | 149.50 | 45 | Gemi İnşaatı ve Gemi Makinaları Mühendisliği Lisans Programı 2009-2010 / Güz Dönemi Öncesi |
| GEM_LS | 758 | 151.00 | 46 | Gemi İnşaatı ve Gemi Makinaları Mühendisliği Lisans Programı 2009-2010 / Güz ile 2012-2013 / Güz Dönemleri Arası |
| GEM_LS | 759 | 152.50 | 46 | Gemi İnşaatı ve Gemi Makinaları Mühendisliği Lisans Programı 2012-2013 / Güz ile 2017-2018 / Güz Dönemleri Arası |
| GEM_LS | 760 | 154.00 | 47 | Gemi İnşaatı ve Gemi Makinaları Mühendisliği Lisans Programı 2017-2018 / Güz ile 2021-2022 / Güz Dönemleri Arası |
| GEM_LS | 1492 | 126.50 | 38 | Gemi İnşaatı ve Gemi Makinaları Mühendisliği Lisans Programı 2021-2022 / Güz ile 2025-2026 / Güz Dönemleri Arası |
| GEM_LS | 2399 | 129.50 | 39 | Gemi İnşaatı ve Gemi Makinaları Mühendisliği Lisans Programı 2025-2026 / Güz Dönemi Sonrası |
| GEO_LS | 387 | 153.00 | 46 | Geomatik Mühendisliği Lisans Programı 2002-2003 / Güz Dönemi Öncesi |
| GEO_LS | 388 | 152.00 | 46 | Geomatik Mühendisliği Lisans Programı 2002-2003 / Güz ile 2009-2010 / Güz Dönemleri Arası |
| GEO_LS | 389 | 153.50 | 47 | Geomatik Mühendisliği Lisans Programı 2009-2010 / Güz ile 2012-2013 / Güz Dönemleri Arası |
| GEO_LS | 390 | 153.50 | 47 | Geomatik Mühendisliği Lisans Programı 2012-2013 / Güz ile 2016-2017 / Güz Dönemleri Arası |
| GEO_LS | 391 | 161.00 | 49 | Geomatik Mühendisliği Lisans Programı 2016-2017 / Güz ile 2017-2018 / Güz Dönemleri Arası |
| GEO_LS | 392 | 155.50 | 47 | Geomatik Mühendisliği Lisans Programı 2017-2018 / Güz ile 2021-2022 / Güz Dönemleri Arası |
| GEO_LS | 1471 | 132.00 | 40 | Geomatik Mühendisliği Lisans Programı 2021-2022 / Güz Dönemi Sonrası |
| GID_LS | 630 | 149.50 | 45 | Gıda Mühendisliği Lisans Programı 2000-2001 / Güz Dönemi Öncesi |
| GID_LS | 631 | 150.00 | 45 | Gıda Mühendisliği Lisans Programı 2000-2001 / Güz ile 2002-2003 / Güz Dönemleri Arası |
| GID_LS | 632 | 149.00 | 45 | Gıda Mühendisliği Lisans Programı 2002-2003 / Güz ile 2009-2010 / Güz Dönemleri Arası |
| GID_LS | 633 | 150.50 | 46 | Gıda Mühendisliği Lisans Programı 2009-2010 / Güz ile 2013-2014 / Güz Dönemleri Arası |
| GID_LS | 634 | 150.50 | 46 | Gıda Mühendisliği Lisans Programı 2013-2014 / Güz ile 2017-2018 / Güz Dönemleri Arası |
| GID_LS | 635 | 151.00 | 46 | Gıda Mühendisliği Lisans Programı 2017-2018 / Güz ile 2021-2022 / Güz Dönemleri Arası |
| GID_LS | 1484 | 133.00 | 40 | Gıda Mühendisliği Lisans Programı 2021-2022 / Güz Dönemi Sonrası |
| GMI_LS | 1001 | 164.50 | 50 | Gemi Makinaları İşletme Mühendisliği Lisans Programı 2004-2005 / Güz Dönemi Öncesi |
| GMI_LS | 1002 | 163.00 | 49 | Gemi Makinaları İşletme Mühendisliği Lisans Programı 2004-2005 / Güz ile 2009-2010 / Güz Dönemleri Arası |
| GMI_LS | 1003 | 164.50 | 50 | Gemi Makinaları İşletme Mühendisliği Lisans Programı 2009-2010 / Güz ile 2011-2012 / Güz Dönemleri Arası |
| GMI_LS | 1004 | 158.00 | 48 | Gemi Makinaları İşletme Mühendisliği Lisans Programı 2011-2012 / Güz ile 2017-2018 / Güz Dönemleri Arası |
| GMI_LS | 1005 | 152.00 | 46 | Gemi Makinaları İşletme Mühendisliği Lisans Programı 2017-2018 / Güz ile 2021-2022 / Güz Dönemleri Arası |
| GMI_LS | 1558 | 133.00 | 40 | Gemi Makinaları İşletme Mühendisliği Lisans Programı 2021-2022 / Güz Dönemi Sonrası |
| HTA_LS | 2294 | 132.00 | 40 | Harita Mühendisliği Lisans Programı 2024-2025 / Güz Dönemi Sonrası |
| IBM_LS | 2298 | 130.50 | 40 | İklim Bilimi ve Meteoroloji Mühendisliği Lisans Programı 2026-2027 / Güz Dönemi Öncesi |
| IBM_LS | 2712 | 131.00 | 40 | İklim Bilimi ve Meteoroloji Mühendisliği Lisans Programı 2026-2027 / Güz Dönemi Sonrası |
| ICM_LS | 139 | 152.00 | 46 | İç Mimarlık Lisans Programı 2003-2004 / Güz Dönemi Öncesi |
| ICM_LS | 140 | 149.00 | 45 | İç Mimarlık Lisans Programı 2003-2004 / Güz ile 2011-2012 / Güz Dönemleri Arası |
| ICM_LS | 141 | 151.00 | 46 | İç Mimarlık Lisans Programı 2011-2012 / Güz ile 2014-2015 / Güz Dönemleri Arası |
| ICM_LS | 142 | 151.00 | 46 | İç Mimarlık Lisans Programı 2014-2015 / Güz ile 2015-2016 / Güz Dönemleri Arası |
| ICM_LS | 143 | 152.00 | 46 | İç Mimarlık Lisans Programı 2015-2016 / Güz ile 2017-2018 / Güz Dönemleri Arası |
| ICM_LS | 144 | 137.50 | 42 | İç Mimarlık Lisans Programı 2017-2018 / Güz ile 2021-2022 / Güz Dönemleri Arası |
| ICM_LS | 1443 | 127.50 | 39 | İç Mimarlık Lisans Programı 2021-2022 / Güz Dönemi Sonrası |
| IML_LS | 466 | 152.00 | 46 | İmalat Mühendisliği Lisans Programı 2006-2007 / Güz Dönemi Öncesi |
| IML_LS | 467 | 152.00 | 46 | İmalat Mühendisliği Lisans Programı 2006-2007 / Güz ile 2009-2010 / Güz Dönemleri Arası |
| IML_LS | 468 | 153.50 | 47 | İmalat Mühendisliği Lisans Programı 2009-2010 / Güz ile 2014-2015 / Güz Dönemleri Arası |
| IML_LS | 469 | 154.50 | 47 | İmalat Mühendisliği Lisans Programı 2014-2015 / Güz ile 2017-2018 / Güz Dönemleri Arası |
| IML_LS | 470 | 154.00 | 47 | İmalat Mühendisliği Lisans Programı 2017-2018 / Güz ile 2026-2027 / Güz Dönemleri Arası |
| INS_LS | 422 | 153.00 | 46 | İnşaat Mühendisliği Lisans Programı 2001-2002 / Güz Dönemi Öncesi |
| INS_LS | 423 | 154.00 | 47 | İnşaat Mühendisliği Lisans Programı 2001-2002 / Güz ile 2005-2006 / Güz Dönemleri Arası |
| INS_LS | 424 | 153.50 | 47 | İnşaat Mühendisliği Lisans Programı 2005-2006 / Güz ile 2009-2010 / Güz Dönemleri Arası |
| INS_LS | 425 | 155.00 | 47 | İnşaat Mühendisliği Lisans Programı 2009-2010 / Güz ile 2012-2013 / Güz Dönemleri Arası |
| INS_LS | 426 | 156.50 | 47 | İnşaat Mühendisliği Lisans Programı 2012-2013 / Güz ile 2017-2018 / Güz Dönemleri Arası |
| INS_LS | 427 | 158.00 | 48 | İnşaat Mühendisliği Lisans Programı 2017-2018 / Güz ile 2021-2022 / Güz Dönemleri Arası |
| INS_LS | 1474 | 132.00 | 40 | İnşaat Mühendisliği Lisans Programı 2021-2022 / Güz Dönemi Sonrası |
| ISL_LS | 877 | 153.00 | 46 | İşletme Mühendisliği Lisans Programı 2000-2001 / Güz Dönemi Öncesi |
| ISL_LS | 878 | 153.00 | 46 | İşletme Mühendisliği Lisans Programı 2000-2001 / Güz ile 2003-2004 / Güz Dönemleri Arası |
| ISL_LS | 879 | 151.00 | 46 | İşletme Mühendisliği Lisans Programı 2003-2004 / Güz ile 2009-2010 / Güz Dönemleri Arası |
| ISL_LS | 880 | 152.50 | 46 | İşletme Mühendisliği Lisans Programı 2009-2010 / Güz ile 2011-2012 / Güz Dönemleri Arası |
| ISL_LS | 881 | 152.50 | 46 | İşletme Mühendisliği Lisans Programı 2011-2012 / Güz ile 2017-2018 / Güz Dönemleri Arası |
| ISL_LS | 882 | 150.00 | 45 | İşletme Mühendisliği Lisans Programı 2017-2018 / Güz Dönemi Sonrası |
| JEF_LS | 561 | 145.00 | 44 | Jeofizik Mühendisliği Lisans Programı 2000-2001 / Güz Dönemi Öncesi |
| JEF_LS | 562 | 146.00 | 44 | Jeofizik Mühendisliği Lisans Programı 2000-2001 / Güz ile 2003-2004 / Güz Dönemleri Arası |
| JEF_LS | 563 | 148.00 | 45 | Jeofizik Mühendisliği Lisans Programı 2003-2004 / Güz ile 2009-2010 / Güz Dönemleri Arası |
| JEF_LS | 564 | 149.50 | 45 | Jeofizik Mühendisliği Lisans Programı 2009-2010 / Güz ile 2017-2018 / Güz Dönemleri Arası |
| JEF_LS | 565 | 154.00 | 47 | Jeofizik Mühendisliği Lisans Programı 2017-2018 / Güz ile 2021-2022 / Güz Dönemleri Arası |
| JEF_LS | 1480 | 129.00 | 39 | Jeofizik Mühendisliği Lisans Programı 2021-2022 / Güz Dönemi Sonrası |
| JEO_LS | 584 | 151.50 | 46 | Jeoloji Mühendisliği Lisans Programı 2000-2001 / Güz Dönemi Öncesi |
| JEO_LS | 585 | 152.50 | 46 | Jeoloji Mühendisliği Lisans Programı 2000-2001 / Güz ile 2002-2003 / Güz Dönemleri Arası |
| JEO_LS | 586 | 150.50 | 46 | Jeoloji Mühendisliği Lisans Programı 2002-2003 / Güz ile 2009-2010 / Güz Dönemleri Arası |
| JEO_LS | 587 | 152.00 | 46 | Jeoloji Mühendisliği Lisans Programı 2009-2010 / Güz ile 2011-2012 / Güz Dönemleri Arası |
| JEO_LS | 588 | 153.00 | 46 | Jeoloji Mühendisliği Lisans Programı 2011-2012 / Güz ile 2017-2018 / Güz Dönemleri Arası |
| JEO_LS | 589 | 151.00 | 46 | Jeoloji Mühendisliği Lisans Programı 2017-2018 / Güz ile 2021-2022 / Güz Dönemleri Arası |
| JEO_LS | 1481 | 138.50 | 42 | Jeoloji Mühendisliği Lisans Programı 2021-2022 / Güz Dönemi Sonrası |
| KIM_LS | 65 | 151.00 | 46 | Kimya Lisans Programı 2009-2010 / Güz Dönemi Öncesi |
| KIM_LS | 66 | 152.50 | 46 | Kimya Lisans Programı 2009-2010 / Güz ile 2010-2011 / Güz Dönemleri Arası |
| KIM_LS | 67 | 152.50 | 46 | Kimya Lisans Programı 2010-2011 / Güz ile 2017-2018 / Güz Dönemleri Arası |
| KIM_LS | 68 | 153.00 | 46 | Kimya Lisans Programı 2017-2018 / Güz ile 2021-2022 / Güz Dönemleri Arası |
| KIM_LS | 1439 | 128.00 | 39 | Kimya Lisans Programı 2021-2022 / Güz Dönemi Sonrası |
| KMM_LS | 671 | 151.00 | 46 | Kimya Mühendisliği Lisans Programı 2000-2001 / Güz Dönemi Öncesi |
| KMM_LS | 672 | 152.00 | 46 | Kimya Mühendisliği Lisans Programı 2000-2001 / Güz ile 2002-2003 / Güz Dönemleri Arası |
| KMM_LS | 673 | 150.00 | 45 | Kimya Mühendisliği Lisans Programı 2002-2003 / Güz ile 2009-2010 / Güz Dönemleri Arası |
| KMM_LS | 674 | 151.50 | 46 | Kimya Mühendisliği Lisans Programı 2009-2010 / Güz ile 2011-2012 / Güz Dönemleri Arası |
| KMM_LS | 675 | 151.50 | 46 | Kimya Mühendisliği Lisans Programı 2011-2012 / Güz ile 2017-2018 / Güz Dönemleri Arası |
| KMM_LS | 676 | 141.00 | 43 | Kimya Mühendisliği Lisans Programı 2017-2018 / Güz ile 2021-2022 / Güz Dönemleri Arası |
| KMM_LS | 1485 | 133.00 | 40 | Kimya Mühendisliği Lisans Programı 2021-2022 / Güz Dönemi Sonrası |
| KOM_LS | 308 | 153.00 | 46 | Kontrol ve Otomasyon Mühendisliği Lisans Programı 2002-2003 / Güz Dönemi Öncesi |
| KOM_LS | 309 | 151.00 | 46 | Kontrol ve Otomasyon Mühendisliği Lisans Programı 2002-2003 / Güz ile 2009-2010 / Güz Dönemleri Arası |
| KOM_LS | 310 | 152.50 | 46 | Kontrol ve Otomasyon Mühendisliği Lisans Programı 2009-2010 / Güz ile 2013-2014 / Güz Dönemleri Arası |
| KOM_LS | 311 | 152.00 | 46 | Kontrol ve Otomasyon Mühendisliği Lisans Programı 2013-2014 / Güz ile 2017-2018 / Güz Dönemleri Arası |
| KOM_LS | 312 | 155.00 | 47 | Kontrol ve Otomasyon Mühendisliği Lisans Programı 2017-2018 / Güz ile 2021-2022 / Güz Dönemleri Arası |
| KOM_LS | 1464 | 130.00 | 39 | Kontrol ve Otomasyon Mühendisliği Lisans Programı 2021-2022 / Güz ile 2025-2026 / Güz Dönemleri Arası |
| KOM_LS | 2580 | 133.00 | 40 | Kontrol ve Otomasyon Mühendisliği Lisans Programı 2025-2026 / Güz Dönemi Sonrası |
| MAD_LS | 601 | 152.00 | 46 | Maden Mühendisliği Lisans Programı 2000-2001 / Güz Dönemi Öncesi |
| MAD_LS | 602 | 153.00 | 46 | Maden Mühendisliği Lisans Programı 2000-2001 / Güz ile 2002-2003 / Güz Dönemleri Arası |
| MAD_LS | 603 | 151.00 | 46 | Maden Mühendisliği Lisans Programı 2002-2003 / Güz ile 2004-2005 / Güz Dönemleri Arası |
| MAD_LS | 604 | 152.00 | 46 | Maden Mühendisliği Lisans Programı 2004-2005 / Güz ile 2009-2010 / Güz Dönemleri Arası |
| MAD_LS | 605 | 153.50 | 47 | Maden Mühendisliği Lisans Programı 2009-2010 / Güz ile 2011-2012 / Güz Dönemleri Arası |
| MAD_LS | 606 | 154.00 | 47 | Maden Mühendisliği Lisans Programı 2011-2012 / Güz ile 2017-2018 / Güz Dönemleri Arası |
| MAD_LS | 607 | 147.00 | 45 | Maden Mühendisliği Lisans Programı 2017-2018 / Güz ile 2021-2022 / Güz Dönemleri Arası |
| MAD_LS | 1482 | 131.00 | 40 | Maden Mühendisliği Lisans Programı 2021-2022 / Güz Dönemi Sonrası |
| MAK_LS | 516 | 152.50 | 46 | Makina Mühendisliği Lisans Programı 2000-2001 / Güz Dönemi Öncesi |
| MAK_LS | 517 | 153.50 | 47 | Makina Mühendisliği Lisans Programı 2000-2001 / Güz ile 2002-2003 / Güz Dönemleri Arası |
| MAK_LS | 518 | 153.50 | 47 | Makina Mühendisliği Lisans Programı 2002-2003 / Güz ile 2003-2004 / Güz Dönemleri Arası |
| MAK_LS | 519 | 153.50 | 47 | Makina Mühendisliği Lisans Programı 2003-2004 / Güz ile 2004-2005 / Güz Dönemleri Arası |
| MAK_LS | 520 | 152.00 | 46 | Makina Mühendisliği Lisans Programı 2004-2005 / Güz ile 2009-2010 / Güz Dönemleri Arası |
| MAK_LS | 521 | 153.50 | 47 | Makina Mühendisliği Lisans Programı 2009-2010 / Güz ile 2011-2012 / Güz Dönemleri Arası |
| MAK_LS | 522 | 154.00 | 47 | Makina Mühendisliği Lisans Programı 2011-2012 / Güz ile 2017-2018 / Güz Dönemleri Arası |
| MAK_LS | 523 | 158.00 | 48 | Makina Mühendisliği Lisans Programı 2017-2018 / Güz ile 2021-2022 / Güz Dönemleri Arası |
| MAK_LS | 1477 | 128.50 | 39 | Makina Mühendisliği Lisans Programı 2021-2022 / Güz ile 2023-2024 / Güz Dönemleri Arası |
| MAK_LS | 1918 | 139.50 | 42 | Makina Mühendisliği Lisans Programı 2023-2024 / Güz Dönemi Sonrası |
| MAT_LS | 101 | 150.00 | 45 | Matematik Mühendisliği Lisans Programı 2000-2001 / Güz Dönemi Öncesi |
| MAT_LS | 102 | 153.00 | 46 | Matematik Mühendisliği Lisans Programı 2000-2001 / Güz ile 2004-2005 / Güz Dönemleri Arası |
| MAT_LS | 103 | 150.00 | 45 | Matematik Mühendisliği Lisans Programı 2004-2005 / Güz ile 2007-2008 / Güz Dönemleri Arası |
| MAT_LS | 104 | 150.00 | 45 | Matematik Mühendisliği Lisans Programı 2007-2008 / Güz ile 2009-2010 / Güz Dönemleri Arası |
| MAT_LS | 105 | 151.50 | 46 | Matematik Mühendisliği Lisans Programı 2009-2010 / Güz ile 2012-2013 / Güz Dönemleri Arası |
| MAT_LS | 106 | 151.50 | 46 | Matematik Mühendisliği Lisans Programı 2012-2013 / Güz ile 2013-2014 / Güz Dönemleri Arası |
| MAT_LS | 107 | 151.50 | 46 | Matematik Mühendisliği Lisans Programı 2013-2014 / Güz ile 2017-2018 / Güz Dönemleri Arası |
| MAT_LS | 108 | 150.00 | 45 | Matematik Mühendisliği Lisans Programı 2017-2018 / Güz ile 2020-2021 / Güz Dönemleri Arası |
| MAT_LS | 109 | 150.00 | 45 | Matematik Mühendisliği Lisans Programı 2020-2021 / Güz ile 2021-2022 / Güz Dönemleri Arası |
| MAT_LS | 1440 | 129.00 | 39 | Matematik Mühendisliği Lisans Programı 2021-2022 / Güz ile 2025-2026 / Güz Dönemleri Arası |
| MAT_LS | 2534 | 129.00 | 39 | Matematik Mühendisliği Lisans Programı 2025-2026 / Güz Dönemi Sonrası |
| MET_LS | 730 | 149.00 | 45 | Metalurji ve Malzeme Mühendisliği Lisans Programı 2000-2001 / Güz Dönemi Öncesi |
| MET_LS | 731 | 150.00 | 45 | Metalurji ve Malzeme Mühendisliği Lisans Programı 2000-2001 / Güz ile 2004-2005 / Güz Dönemleri Arası |
| MET_LS | 732 | 149.50 | 45 | Metalurji ve Malzeme Mühendisliği Lisans Programı 2004-2005 / Güz ile 2009-2010 / Güz Dönemleri Arası |
| MET_LS | 733 | 151.00 | 46 | Metalurji ve Malzeme Mühendisliği Lisans Programı 2009-2010 / Güz ile 2011-2012 / Güz Dönemleri Arası |
| MET_LS | 734 | 150.00 | 45 | Metalurji ve Malzeme Mühendisliği Lisans Programı 2011-2012 / Güz ile 2017-2018 / Güz Dönemleri Arası |
| MET_LS | 735 | 154.00 | 47 | Metalurji ve Malzeme Mühendisliği Lisans Programı 2017-2018 / Güz ile 2021-2022 / Güz Dönemleri Arası |
| MET_LS | 1489 | 131.00 | 40 | Metalurji ve Malzeme Mühendisliği Lisans Programı 2021-2022 / Güz Dönemi Sonrası |
| MIM_LS | 166 | 151.00 | 46 | Mimarlık Lisans Programı 2001-2002 / Güz Dönemi Öncesi |
| MIM_LS | 167 | 156.00 | 47 | Mimarlık Lisans Programı 2001-2002 / Güz ile 2002-2003 / Güz Dönemleri Arası |
| MIM_LS | 168 | 154.00 | 47 | Mimarlık Lisans Programı 2002-2003 / Güz ile 2003-2004 / Güz Dönemleri Arası |
| MIM_LS | 169 | 152.50 | 46 | Mimarlık Lisans Programı 2003-2004 / Güz ile 2009-2010 / Güz Dönemleri Arası |
| MIM_LS | 170 | 152.50 | 46 | Mimarlık Lisans Programı 2009-2010 / Güz ile 2011-2012 / Güz Dönemleri Arası |
| MIM_LS | 171 | 153.00 | 46 | Mimarlık Lisans Programı 2011-2012 / Güz ile 2015-2016 / Güz Dönemleri Arası |
| MIM_LS | 172 | 156.00 | 47 | Mimarlık Lisans Programı 2015-2016 / Güz ile 2017-2018 / Güz Dönemleri Arası |
| MIM_LS | 173 | 157.50 | 48 | Mimarlık Lisans Programı 2017-2018 / Güz ile 2021-2022 / Güz Dönemleri Arası |
| MIM_LS | 1445 | 132.00 | 40 | Mimarlık Lisans Programı 2021-2022 / Güz Dönemi Sonrası |
| MTO_LS | 906 | 151.00 | 46 | Meteoroloji Mühendisliği Lisans Programı 2003-2004 / Güz Dönemi Öncesi |
| MTO_LS | 907 | 149.00 | 45 | Meteoroloji Mühendisliği Lisans Programı 2003-2004 / Güz ile 2009-2010 / Güz Dönemleri Arası |
| MTO_LS | 908 | 152.50 | 46 | Meteoroloji Mühendisliği Lisans Programı 2009-2010 / Güz ile 2017-2018 / Güz Dönemleri Arası |
| MTO_LS | 909 | 153.50 | 47 | Meteoroloji Mühendisliği Lisans Programı 2017-2018 / Güz ile 2021-2022 / Güz Dönemleri Arası |
| MTO_LS | 1554 | 130.50 | 40 | Meteoroloji Mühendisliği Lisans Programı 2021-2022 / Güz Dönemi Sonrası |
| MTT_LS | 2612 | 130.00 | 39 | Matematik Lisans Programı 2026-2027 / Güz Dönemi Sonrası |
| PEM_LS | 194 | 150.00 | 45 | Peyzaj Mimarlığı Lisans Programı |
| PET_LS | 615 | 150.00 | 45 | Petrol ve Doğal Gaz Mühendisliği Lisans Programı 2000-2001 / Güz Dönemi Öncesi |
| PET_LS | 616 | 149.00 | 45 | Petrol ve Doğal Gaz Mühendisliği Lisans Programı 2000-2001 / Güz ile 2009-2010 / Güz Dönemleri Arası |
| PET_LS | 617 | 150.50 | 46 | Petrol ve Doğal Gaz Mühendisliği Lisans Programı 2009-2010 / Güz Dönemi Sonrası |
| ROS_LS | 2296 | 132.00 | 40 | Robotik ve Otonom Sistemleri Mühendisliği Lisans Programı 2024-2025 / Güz Dönemi Sonrası |
| SBP_LS | 209 | 151.00 | 46 | Şehir ve Bölge Planlama Lisans Programı 2011-2012 / Güz Dönemi Öncesi |
| SBP_LS | 210 | 153.50 | 47 | Şehir ve Bölge Planlama Lisans Programı 2011-2012 / Güz ile 2015-2016 / Güz Dönemleri Arası |
| SBP_LS | 211 | 156.50 | 47 | Şehir ve Bölge Planlama Lisans Programı 2015-2016 / Güz ile 2017-2018 / Güz Dönemleri Arası |
| SBP_LS | 212 | 157.00 | 48 | Şehir ve Bölge Planlama Lisans Programı 2017-2018 / Güz ile 2021-2022 / Güz Dönemleri Arası |
| SBP_LS | 1448 | 130.00 | 39 | Şehir ve Bölge Planlama Lisans Programı 2021-2022 / Güz Dönemi Sonrası |
| TEK_LS | 1130 | 153.00 | 46 | Tekstil Mühendisliği Lisans Programı 2000-2001 / Güz Dönemi Öncesi |
| TEK_LS | 1131 | 154.00 | 47 | Tekstil Mühendisliği Lisans Programı 2000-2001 / Güz ile 2002-2003 / Güz Dönemleri Arası |
| TEK_LS | 1132 | 153.00 | 46 | Tekstil Mühendisliği Lisans Programı 2002-2003 / Güz ile 2009-2010 / Güz Dönemleri Arası |
| TEK_LS | 1133 | 154.50 | 47 | Tekstil Mühendisliği Lisans Programı 2009-2010 / Güz Dönemi Sonrası |
| TEL_LS | 347 | 149.00 | 45 | Telekomünikasyon Mühendisliği Lisans Programı 2006-2007 / Güz Dönemi Öncesi |
| TEL_LS | 348 | 148.00 | 45 | Telekomünikasyon Mühendisliği Lisans Programı 2006-2007 / Güz ile 2008-2009 / Güz Dönemleri Arası |
| TEL_LS | 349 | 151.00 | 46 | Telekomünikasyon Mühendisliği Lisans Programı 2008-2009 / Güz ile 2009-2010 / Güz Dönemleri Arası |
| TEL_LS | 350 | 152.50 | 46 | Telekomünikasyon Mühendisliği Lisans Programı 2009-2010 / Güz Dönemi Sonrası |
| UCK_LS | 939 | 153.00 | 46 | Uçak Mühendisliği Lisans Programı 2002-2003 / Güz Dönemi Öncesi |
| UCK_LS | 940 | 152.00 | 46 | Uçak Mühendisliği Lisans Programı 2002-2003 / Güz ile 2009-2010 / Güz Dönemleri Arası |
| UCK_LS | 941 | 153.00 | 46 | Uçak Mühendisliği Lisans Programı 2009-2010 / Güz ile 2017-2018 / Güz Dönemleri Arası |
| UCK_LS | 942 | 155.00 | 47 | Uçak Mühendisliği Lisans Programı 2017-2018 / Güz ile 2021-2022 / Güz Dönemleri Arası |
| UCK_LS | 1555 | 131.00 | 40 | Uçak Mühendisliği Lisans Programı 2021-2022 / Güz Dönemi Sonrası |
| UZB_LS | 965 | 153.00 | 46 | Uzay Mühendisliği Lisans Programı 2002-2003 / Güz Dönemi Öncesi |
| UZB_LS | 966 | 153.00 | 46 | Uzay Mühendisliği Lisans Programı 2002-2003 / Güz ile 2009-2010 / Güz Dönemleri Arası |
| UZB_LS | 967 | 153.00 | 46 | Uzay Mühendisliği Lisans Programı 2009-2010 / Güz Dönemi Sonrası |
